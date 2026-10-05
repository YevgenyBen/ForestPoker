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

/** Lifetime net per player across the given closed-game ledger entries. */
export function computeLeagueStandings(input: {
  playerIds: string[];
  ledgerEntries: StandingsLedgerEntry[];
  usernames: Map<string, string>;
}): LeagueStandingRow[] {
  const net = computeNetByUser(input.ledgerEntries);
  return input.playerIds
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
