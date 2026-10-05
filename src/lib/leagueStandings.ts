import { computeNetByUser } from "@/lib/settlement";

export type StandingsClosedGame = {
  id: string;
  closedAt: Date | null;
  createdAt: Date;
};

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

export type LeagueStandings = {
  active: LeagueStandingRow[];
  inactive: LeagueStandingRow[];
};

/**
 * League standings across closed games, split into active and inactive players.
 * Only players who bought in at least once have played, so only they are listed.
 * A player is active when they played more than `activityThresholdPct` percent of
 * the closed games held since the first closed game they played (inclusive).
 * Activity never changes lifetime net.
 */
export function computeLeagueStandings(input: {
  closedGames: StandingsClosedGame[];
  ledgerEntries: StandingsLedgerEntry[];
  usernames: Map<string, string>;
  activityThresholdPct: number;
}): LeagueStandings {
  const positionByGameId = closedGamePositions(input.closedGames);
  const net = computeNetByUser(input.ledgerEntries);

  const playedPositions = new Map<string, Set<number>>();
  for (const e of input.ledgerEntries) {
    const position = positionByGameId.get(e.gameId);
    if (e.kind !== "buy_in" || position === undefined) continue;
    const played = playedPositions.get(e.userId) ?? new Set<number>();
    played.add(position);
    playedPositions.set(e.userId, played);
  }

  const standings: LeagueStandings = { active: [], inactive: [] };
  for (const [userId, played] of playedPositions) {
    const eligibleGameCount = positionByGameId.size - Math.min(...played);
    const isActive =
      played.size * 100 > input.activityThresholdPct * eligibleGameCount;
    (isActive ? standings.active : standings.inactive).push({
      userId,
      username: input.usernames.get(userId) ?? userId,
      lifetimeNetNis: net.get(userId) ?? 0,
    });
  }
  standings.active.sort(byLifetimeNetThenName);
  standings.inactive.sort(byLifetimeNetThenName);
  return standings;
}

/** Position of each closed game in close order (falling back to creation time). */
function closedGamePositions(closedGames: StandingsClosedGame[]) {
  const at = (g: StandingsClosedGame) =>
    (g.closedAt ?? g.createdAt).getTime();
  const sorted = [...closedGames].sort((a, b) => at(a) - at(b));
  return new Map(sorted.map((g, i) => [g.id, i]));
}

function byLifetimeNetThenName(a: LeagueStandingRow, b: LeagueStandingRow) {
  if (b.lifetimeNetNis !== a.lifetimeNetNis) {
    return b.lifetimeNetNis - a.lifetimeNetNis;
  }
  return a.username.localeCompare(b.username, undefined, {
    sensitivity: "base",
  });
}
