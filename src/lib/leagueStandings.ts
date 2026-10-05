import { computeNetByUser } from "@/lib/settlement";

export type StandingsLedgerEntry = {
  gameId: string;
  userId: string;
  kind: "buy_in" | "buy_out";
  amountNis: number;
};

export type LeagueStandingRow = {
  userId: string;
  username: string;
  lifetimeNetNis: number;
};

/**
 * Lifetime net per player across the given closed-game ledger entries.
 * Only players who bought in at least once have played, so only they are listed.
 */
export function computeLeagueStandings(input: {
  ledgerEntries: StandingsLedgerEntry[];
  usernames: Map<string, string>;
}): LeagueStandingRow[] {
  const net = computeNetByUser(input.ledgerEntries);
  const playerIds = new Set(
    input.ledgerEntries.filter((e) => e.kind === "buy_in").map((e) => e.userId)
  );
  return [...playerIds]
    .map((id) => ({
      userId: id,
      username: input.usernames.get(id) ?? id,
      lifetimeNetNis: net.get(id) ?? 0,
    }))
    .sort(byLifetimeNetThenName);
}

function byLifetimeNetThenName(a: LeagueStandingRow, b: LeagueStandingRow) {
  if (b.lifetimeNetNis !== a.lifetimeNetNis) {
    return b.lifetimeNetNis - a.lifetimeNetNis;
  }
  return a.username.localeCompare(b.username, undefined, {
    sensitivity: "base",
  });
}
