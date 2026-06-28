import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = "forest-poker-web-a8k3";
const LOCATION = "us-east4";
const BACKEND_ID = "forest-poker";
const API_ORIGIN = "https://firebaseapphosting.googleapis.com/v1beta";
const POLL_MS = 15_000;
const MAX_WAIT_MS = 25 * 60 * 1000;

const ACTIVE_BUILD_STATES = new Set([
  "STATE_UNSPECIFIED",
  "BUILDING",
  "BUILT",
  "DEPLOYING",
]);
const ACTIVE_ROLLOUT_STATES = new Set([
  "STATE_UNSPECIFIED",
  "QUEUED",
  "PENDING_BUILD",
  "PROGRESSING",
  "PAUSED",
]);

const commitSha = process.env.GITHUB_SHA;
if (!commitSha) {
  throw new Error("GITHUB_SHA is required");
}

const runId = process.env.GITHUB_RUN_ID ?? String(Date.now());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildResourceName(buildId) {
  return `projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}/builds/${buildId}`;
}

function commitFromBuild(build) {
  const codebase = build?.source?.codebase;
  return codebase?.commit ?? codebase?.hash ?? null;
}

function isActiveBuild(build) {
  return ACTIVE_BUILD_STATES.has(build.state) || build.reconciling === true;
}

function isActiveRollout(rollout) {
  return ACTIVE_ROLLOUT_STATES.has(rollout.state) || rollout.reconciling === true;
}

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Failed to obtain Google access token");
  }
  return token.token;
}

async function apiRequest(path, { method = "GET", body, query } = {}) {
  const token = await getAccessToken();
  const url = new URL(`${API_ORIGIN}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${url}: HTTP ${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : {};
}

async function listCollection(collection) {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}`;
  const items = [];
  let pageToken;

  do {
    const query = pageToken ? { pageToken } : undefined;
    const body = await apiRequest(`${parent}/${collection}`, { query });
    const key = collection === "builds" ? "builds" : "rollouts";
    items.push(...(body[key] ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);

  return items;
}

async function getBuild(buildId) {
  try {
    return await apiRequest(buildResourceName(buildId));
  } catch (error) {
    if (error instanceof Error && error.message.includes("HTTP 404")) {
      return null;
    }
    throw error;
  }
}

async function getRollout(rolloutId) {
  return apiRequest(
    `projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}/rollouts/${rolloutId}`,
  );
}

async function waitUntil(predicate, label) {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    if (await predicate()) {
      return;
    }
    console.log(label);
    await sleep(POLL_MS);
  }
  throw new Error(`Timed out after ${MAX_WAIT_MS / 1000}s: ${label}`);
}

async function waitForBuildReady(buildId) {
  await waitUntil(async () => {
    const build = await getBuild(buildId);
    if (!build) {
      console.log(`Build ${buildId} not visible yet`);
      return false;
    }
    if (build.state === "READY") {
      return true;
    }
    if (build.state === "FAILED" || build.state === "EXPIRED" || build.state === "SKIPPED") {
      const logs = build.buildLogsUri ? ` Logs: ${build.buildLogsUri}` : "";
      throw new Error(`Build ${buildId} ended in state ${build.state}.${logs}`);
    }
    console.log(`Build ${buildId} state: ${build.state}`);
    return false;
  }, `Waiting for build ${buildId} to become READY...`);
}

async function waitForRolloutDone(rolloutId) {
  await waitUntil(async () => {
    const rollout = await getRollout(rolloutId);
    if (rollout.state === "SUCCEEDED") {
      return true;
    }
    if (
      rollout.state === "FAILED" ||
      rollout.state === "CANCELLED" ||
      rollout.state === "SKIPPED"
    ) {
      throw new Error(
        `Rollout ${rolloutId} ended in state ${rollout.state}: ${rollout.error?.message ?? "unknown error"}`,
      );
    }
    console.log(`Rollout ${rolloutId} state: ${rollout.state}`);
    return false;
  }, `Waiting for rollout ${rolloutId} to succeed...`);
}

async function waitForQueueIdle() {
  await waitUntil(async () => {
    const [builds, rollouts] = await Promise.all([
      listCollection("builds"),
      listCollection("rollouts"),
    ]);
    const activeBuilds = builds.filter(isActiveBuild);
    const activeRollouts = rollouts.filter(isActiveRollout);
    if (activeBuilds.length === 0 && activeRollouts.length === 0) {
      return true;
    }
    console.log(
      `Queue busy: ${activeBuilds.length} active build(s), ${activeRollouts.length} active rollout(s)`,
    );
    return false;
  }, "Waiting for App Hosting build queue to become idle...");
}

async function createBuild(buildId, commit) {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}`;
  console.log(`Creating build ${buildId} for commit ${commit.slice(0, 7)}`);
  await apiRequest(`${parent}/builds`, {
    method: "POST",
    query: {
      buildId,
    },
    body: {
      source: {
        codebase: {
          commit,
        },
      },
    },
  });
}

async function createRollout(rolloutId, buildId) {
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/backends/${BACKEND_ID}`;
  console.log(`Creating rollout ${rolloutId} for build ${buildId}`);
  await apiRequest(`${parent}/rollouts`, {
    method: "POST",
    query: {
      rolloutId,
    },
    body: {
      build: buildResourceName(buildId),
    },
  });
}

function findBuildForCommit(builds, commit) {
  return builds.find((build) => commitFromBuild(build) === commit);
}

function findRolloutForBuild(rollouts, buildId) {
  const buildName = buildResourceName(buildId);
  return rollouts.find((rollout) => rollout.build === buildName);
}

async function main() {
  console.log(`App Hosting rollout for ${commitSha.slice(0, 7)} (run ${runId})`);

  let builds = await listCollection("builds");
  let rollouts = await listCollection("rollouts");

  const existingBuild = findBuildForCommit(builds, commitSha);
  if (
    existingBuild &&
    existingBuild.state !== "FAILED" &&
    existingBuild.state !== "EXPIRED" &&
    existingBuild.state !== "SKIPPED"
  ) {
    const buildId = existingBuild.name.split("/").pop();
    console.log(`Found existing build ${buildId} for this commit`);

    const existingRollout = findRolloutForBuild(rollouts, buildId);
    if (existingRollout?.state === "SUCCEEDED") {
      console.log(`Rollout ${existingRollout.name.split("/").pop()} already succeeded`);
      return;
    }
    if (existingRollout && isActiveRollout(existingRollout)) {
      const rolloutId = existingRollout.name.split("/").pop();
      await waitForRolloutDone(rolloutId);
      return;
    }

    if (isActiveBuild(existingBuild)) {
      await waitForBuildReady(buildId);
    } else if (existingBuild.state !== "READY") {
      throw new Error(`Existing build ${buildId} is in unusable state ${existingBuild.state}`);
    }

    if (!existingRollout) {
      await createRollout(buildId, buildId);
      await waitForRolloutDone(buildId);
    }
    return;
  }

  await waitForQueueIdle();

  const buildId = `build-gh-${runId}`;
  await createBuild(buildId, commitSha);
  await waitForBuildReady(buildId);
  await createRollout(buildId, buildId);
  await waitForRolloutDone(buildId);

  console.log("App Hosting rollout completed successfully");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
