import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSyncState, games } from "@/db/schema";
import { peekSessionCookie } from "@/lib/auth/session";
import {
  getCachedGameDigest,
  getCachedGlobalDigest,
} from "@/lib/sync/digestCache";

export const dynamic = "force-dynamic";

const APP_SYNC_ROW_ID = 1;

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
} as const;

async function loadGlobalVersion(): Promise<string> {
  const [row] = await db
    .select({ version: appSyncState.version })
    .from(appSyncState)
    .where(eq(appSyncState.id, APP_SYNC_ROW_ID))
    .limit(1);
  return String(row?.version ?? 0);
}

async function loadGameVersion(gameId: string): Promise<string | null> {
  const [row] = await db
    .select({ syncVersion: games.syncVersion })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!row) return null;
  return String(row.syncVersion);
}

async function requireGameVersion(gameId: string): Promise<string> {
  const v = await loadGameVersion(gameId);
  if (v === null) throw new Error("not_found");
  return v;
}

function digestResponse(v: string, req: Request) {
  const etag = `"${v}"`;
  const headers = { ...NO_STORE, ETag: etag };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json({ v }, { headers });
}

/**
 * Cheap sync fingerprint: global row version, or per-game `sync_version`.
 * Cached ~2.5s per instance; supports ETag / If-None-Match for 304 responses.
 */
export async function GET(req: Request) {
  const hasSession = await peekSessionCookie();
  if (!hasSession) {
    return NextResponse.json({ v: "guest" }, { headers: NO_STORE });
  }

  const gameId = new URL(req.url).searchParams.get("gameId")?.trim() || null;

  try {
    const v = gameId
      ? await getCachedGameDigest(gameId, () => requireGameVersion(gameId))
      : await getCachedGlobalDigest(loadGlobalVersion);
    return digestResponse(v, req);
  } catch (e) {
    if (e instanceof Error && e.message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }
}
