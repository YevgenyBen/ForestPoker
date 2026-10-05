import { describe, expect, it } from "vitest";
import { computeLeagueStandings } from "./leagueStandings";

const usernames = new Map([
  ["u-alice", "alice"],
  ["u-bob", "bob"],
]);

/** A closed game that closed on day `day` of October 2026. */
function closedOn(id: string, day: number) {
  const at = new Date(Date.UTC(2026, 9, day, 22));
  return { id, closedAt: at, createdAt: at };
}

/** Closed games g1…gN, closing on consecutive days. */
function closedGames(count: number) {
  return Array.from({ length: count }, (_, i) => closedOn(`g${i + 1}`, i + 1));
}

function buyIn(gameId: string, userId: string, amountNis = 100) {
  return { gameId, userId, kind: "buy_in" as const, amountNis };
}

function buyOut(gameId: string, userId: string, amountNis: number) {
  return { gameId, userId, kind: "buy_out" as const, amountNis };
}

/** Usernames in a section, alphabetically: for tests about who is listed, not ranking. */
function names(rows: { username: string }[]) {
  return rows.map((r) => r.username).sort();
}

describe("league standings", () => {
  it("gives each player their lifetime net: buy-outs minus buy-ins across closed games", () => {
    const standings = computeLeagueStandings({
      closedGames: closedGames(2),
      ledgerEntries: [
        buyIn("g1", "u-alice", 100),
        buyOut("g1", "u-alice", 250),
        buyIn("g2", "u-alice", 100),
        buyIn("g1", "u-bob", 200),
        buyOut("g2", "u-bob", 30),
      ],
      usernames,
      activityThresholdPct: 50,
    });

    expect(standings).toEqual({
      active: [{ userId: "u-alice", username: "alice", lifetimeNetNis: 50 }],
      inactive: [{ userId: "u-bob", username: "bob", lifetimeNetNis: -170 }],
    });
  });

  it("keeps a player's lifetime net the same whether they are active or inactive", () => {
    const input = {
      closedGames: closedGames(4),
      ledgerEntries: [
        buyIn("g1", "u-bob", 100),
        buyOut("g1", "u-bob", 180),
        buyIn("g2", "u-bob", 100),
        buyIn("g3", "u-bob", 100),
      ],
      usernames,
    };

    const atHalf = computeLeagueStandings({ ...input, activityThresholdPct: 50 });
    const atThreeQuarters = computeLeagueStandings({ ...input, activityThresholdPct: 75 });

    expect(atHalf.active).toEqual([{ userId: "u-bob", username: "bob", lifetimeNetNis: -120 }]);
    expect(atThreeQuarters.inactive).toEqual([
      { userId: "u-bob", username: "bob", lifetimeNetNis: -120 },
    ]);
  });

  it("ranks by lifetime net, highest first, breaking ties alphabetically ignoring case", () => {
    const { active } = computeLeagueStandings({
      closedGames: closedGames(1),
      ledgerEntries: [
        buyIn("g1", "u-loser", 300),
        buyIn("g1", "u-zed"),
        buyOut("g1", "u-zed", 140),
        buyIn("g1", "u-amy"),
        buyOut("g1", "u-amy", 140),
        buyIn("g1", "u-winner"),
        buyOut("g1", "u-winner", 320),
      ],
      usernames: new Map([
        ["u-loser", "Loser"],
        ["u-zed", "Zed"],
        ["u-amy", "amy"],
        ["u-winner", "Winner"],
      ]),
      activityThresholdPct: 50,
    });

    expect(active.map((r) => r.username)).toEqual(["Winner", "amy", "Zed", "Loser"]);
  });

  it("ranks inactive players by lifetime net too", () => {
    const { inactive } = computeLeagueStandings({
      closedGames: closedGames(3),
      ledgerEntries: [
        buyIn("g1", "u-carol", 50),
        buyIn("g1", "u-alice", 300),
        buyIn("g1", "u-bob", 50),
        buyIn("g3", "u-dave"),
      ],
      usernames: new Map([
        ["u-alice", "alice"],
        ["u-bob", "Bob"],
        ["u-carol", "carol"],
      ]),
      activityThresholdPct: 50,
    });

    expect(inactive.map((r) => r.username)).toEqual(["Bob", "carol", "alice"]);
  });

  it("leaves out players who never bought in, since they never played", () => {
    const standings = computeLeagueStandings({
      closedGames: closedGames(1),
      ledgerEntries: [buyIn("g1", "u-alice"), buyOut("g1", "u-alice", 100), buyOut("g1", "u-bob", 20)],
      usernames,
      activityThresholdPct: 50,
    });

    expect(standings).toEqual({
      active: [{ userId: "u-alice", username: "alice", lifetimeNetNis: 0 }],
      inactive: [],
    });
  });

  it("does not count a game as played when the player only has a buy-out in it", () => {
    const { inactive } = computeLeagueStandings({
      closedGames: closedGames(3),
      ledgerEntries: [buyIn("g1", "u-bob"), buyOut("g2", "u-bob", 40)],
      usernames,
      activityThresholdPct: 50,
    });

    expect(inactive).toEqual([{ userId: "u-bob", username: "bob", lifetimeNetNis: -60 }]);
  });

  it("makes a player who played their only closed game so far an active player", () => {
    const { active } = computeLeagueStandings({
      closedGames: closedGames(2),
      ledgerEntries: [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g2", "u-bob")],
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(active)).toEqual(["alice", "bob"]);
  });

  it("makes a player who played exactly the threshold share an inactive player", () => {
    const { active, inactive } = computeLeagueStandings({
      closedGames: closedGames(2),
      ledgerEntries: [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g1", "u-bob")],
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(active)).toEqual(["alice"]);
    expect(names(inactive)).toEqual(["bob"]);
  });

  it("makes a player just over the threshold share an active player", () => {
    const { active } = computeLeagueStandings({
      closedGames: closedGames(3),
      ledgerEntries: [buyIn("g1", "u-bob"), buyIn("g3", "u-bob")],
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(active)).toEqual(["bob"]);
  });

  it("counts only the closed games held since the player's first played game", () => {
    const { active } = computeLeagueStandings({
      closedGames: closedGames(4),
      ledgerEntries: [
        buyIn("g1", "u-alice"),
        buyIn("g2", "u-alice"),
        buyIn("g3", "u-alice"),
        buyIn("g4", "u-alice"),
        buyIn("g3", "u-bob"),
        buyIn("g4", "u-bob"),
      ],
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(active)).toEqual(["alice", "bob"]);
  });

  it("keeps an active player active after missed games until their share falls to the threshold", () => {
    const playedFirstThree = [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g3", "u-alice")];

    const afterFive = computeLeagueStandings({
      closedGames: closedGames(5),
      ledgerEntries: playedFirstThree,
      usernames,
      activityThresholdPct: 50,
    });
    const afterSix = computeLeagueStandings({
      closedGames: closedGames(6),
      ledgerEntries: playedFirstThree,
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(afterFive.active)).toEqual(["alice"]);
    expect(names(afterSix.inactive)).toEqual(["alice"]);
  });

  it("applies the league's activity threshold", () => {
    const input = {
      closedGames: closedGames(4),
      ledgerEntries: [buyIn("g1", "u-bob"), buyIn("g2", "u-bob"), buyIn("g3", "u-bob")],
      usernames,
    };

    expect(names(computeLeagueStandings({ ...input, activityThresholdPct: 50 }).active)).toEqual(["bob"]);
    expect(names(computeLeagueStandings({ ...input, activityThresholdPct: 75 }).inactive)).toEqual(["bob"]);
  });

  it("orders closed games by close time, falling back to creation time", () => {
    const late = { id: "g-late", closedAt: null, createdAt: new Date(Date.UTC(2026, 9, 3)) };
    const { active } = computeLeagueStandings({
      closedGames: [late, closedOn("g2", 2), closedOn("g1", 1)],
      ledgerEntries: [buyIn("g-late", "u-bob")],
      usernames,
      activityThresholdPct: 50,
    });

    expect(names(active)).toEqual(["bob"]);
  });

  it("is empty when there are no closed games", () => {
    expect(
      computeLeagueStandings({
        closedGames: [],
        ledgerEntries: [],
        usernames: new Map(),
        activityThresholdPct: 50,
      })
    ).toEqual({ active: [], inactive: [] });
  });
});
