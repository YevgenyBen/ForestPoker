import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSyncState, games } from "@/db/schema";

const APP_SYNC_ROW_ID = 1;

type DbClient = Pick<typeof db, "insert" | "update">;

/** Bump global and optional per-game sync versions after a mutation. */
export async function bumpSyncVersion(
  client: DbClient = db,
  opts?: { gameId?: string }
) {
  await client
    .insert(appSyncState)
    .values({ id: APP_SYNC_ROW_ID, version: 1 })
    .onConflictDoUpdate({
      target: appSyncState.id,
      set: { version: sql`${appSyncState.version} + 1` },
    });

  if (opts?.gameId) {
    await client
      .update(games)
      .set({ syncVersion: sql`${games.syncVersion} + 1` })
      .where(eq(games.id, opts.gameId));
  }
}
