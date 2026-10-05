import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries } from "@/db/schema";

/**
 * Every ledger read goes through this module (ledger.test.ts fails on a direct
 * `.from(ledgerEntries)` anywhere else), so voided (undone) entries are always
 * left out: they stay on record but count for nothing — not the bank, totals,
 * lifetime net, or whether the player played.
 */

type DbReader = Pick<typeof db, "select">;

const notVoided = isNull(ledgerEntries.voidedAt);

const liveEntryColumns = {
  id: ledgerEntries.id,
  gameId: ledgerEntries.gameId,
  userId: ledgerEntries.userId,
  kind: ledgerEntries.kind,
  amountNis: ledgerEntries.amountNis,
  recordedAt: ledgerEntries.recordedAt,
};

export type LiveLedgerFilter = {
  gameIds: string[];
  /** Only this player's entries. */
  userId?: string;
};

/** Query for live entries in the given games, oldest first. */
export function liveLedgerQuery(client: DbReader, filter: LiveLedgerFilter) {
  return client
    .select(liveEntryColumns)
    .from(ledgerEntries)
    .where(
      and(
        inArray(ledgerEntries.gameId, filter.gameIds),
        filter.userId ? eq(ledgerEntries.userId, filter.userId) : undefined,
        notVoided
      )
    )
    .orderBy(asc(ledgerEntries.recordedAt), asc(ledgerEntries.id));
}

/** Live (not voided) ledger entries in the given games, oldest first. */
export async function liveLedgerEntries(
  client: DbReader,
  filter: LiveLedgerFilter
) {
  if (filter.gameIds.length === 0) return [];
  return liveLedgerQuery(client, filter);
}

/** Query for a player's most recent live entry in a game. */
export function latestLiveEntryQuery(
  client: DbReader,
  gameId: string,
  userId: string
) {
  return client
    .select(liveEntryColumns)
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.gameId, gameId),
        eq(ledgerEntries.userId, userId),
        notVoided
      )
    )
    .orderBy(desc(ledgerEntries.recordedAt), desc(ledgerEntries.id))
    .limit(1);
}

/** The player's most recent entry in a game that hasn't been undone. */
export async function latestLiveEntry(
  client: DbReader,
  gameId: string,
  userId: string
) {
  const [entry] = await latestLiveEntryQuery(client, gameId, userId);
  return entry ?? null;
}
