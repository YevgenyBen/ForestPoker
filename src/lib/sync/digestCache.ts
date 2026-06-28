/** Coalesce digest DB reads across concurrent polls on the same instance. */
const TTL_MS = 2500;

type CacheEntry = { v: string; fetchedAt: number };

let globalEntry: CacheEntry | null = null;
const gameEntries = new Map<string, CacheEntry>();

async function readCached(
  key: string | null,
  load: () => Promise<string>
): Promise<string> {
  const now = Date.now();
  if (key === null) {
    if (globalEntry && now - globalEntry.fetchedAt < TTL_MS) {
      return globalEntry.v;
    }
    const v = await load();
    globalEntry = { v, fetchedAt: now };
    return v;
  }

  const hit = gameEntries.get(key);
  if (hit && now - hit.fetchedAt < TTL_MS) {
    return hit.v;
  }
  const v = await load();
  gameEntries.set(key, { v, fetchedAt: now });
  return v;
}

export function getCachedGlobalDigest(load: () => Promise<string>) {
  return readCached(null, load);
}

export function getCachedGameDigest(gameId: string, load: () => Promise<string>) {
  return readCached(gameId, load);
}
