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

/** Usernames in a section, alphabetically: for tests about who is listed, not ranking. */
function names(rows: { username: string }[]) {
  return rows.map((r) => r.username).sort();
}

function buyIn(gameId: string, userId: string, amountNis = 100) {
  return { gameId, userId, kind: "buy_in" as const, amountNis };
}

describe("league standings", () => {
  it("gives each player their lifetime net: buy-outs minus buy-ins across closed games", () => {
    const standings = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2)],
      ledgerEntries: [
        { gameId: "g1", userId: "u-alice", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-alice", kind: "buy_out", amountNis: 250 },
        { gameId: "g2", userId: "u-alice", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-bob", kind: "buy_in", amountNis: 200 },
        { gameId: "g2", userId: "u-bob", kind: "buy_out", amountNis: 30 },
      ],
      usernames,
      activeThresholdPct: 50,
    });

    expect(standings).toEqual({
      active: [{ userId: "u-alice", username: "alice", lifetimeNetNis: 50 }],
      inactive: [{ userId: "u-bob", username: "bob", lifetimeNetNis: -170 }],
    });
  });

  it("ranks by lifetime net, highest first, breaking ties alphabetically ignoring case", () => {
    const { active } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1)],
      ledgerEntries: [
        { gameId: "g1", userId: "u-loser", kind: "buy_in", amountNis: 300 },
        { gameId: "g1", userId: "u-zed", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-zed", kind: "buy_out", amountNis: 140 },
        { gameId: "g1", userId: "u-amy", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-amy", kind: "buy_out", amountNis: 140 },
        { gameId: "g1", userId: "u-winner", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-winner", kind: "buy_out", amountNis: 320 },
      ],
      usernames: new Map([
        ["u-loser", "Loser"],
        ["u-zed", "Zed"],
        ["u-amy", "amy"],
        ["u-winner", "Winner"],
      ]),
      activeThresholdPct: 50,
    });

    expect(active.map((r) => r.username)).toEqual(["Winner", "amy", "Zed", "Loser"]);
  });

  it("leaves out players who never bought in, since they never played", () => {
    const standings = computeLeagueStandings({
      closedGames: [closedOn("g1", 1)],
      ledgerEntries: [
        { gameId: "g1", userId: "u-alice", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-alice", kind: "buy_out", amountNis: 100 },
        { gameId: "g1", userId: "u-bob", kind: "buy_out", amountNis: 20 },
      ],
      usernames,
      activeThresholdPct: 50,
    });

    expect(standings).toEqual({
      active: [{ userId: "u-alice", username: "alice", lifetimeNetNis: 0 }],
      inactive: [],
    });
  });

  it("treats a guest who played once and missed the next closed game (exactly half) as inactive", () => {
    const { active, inactive } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2)],
      ledgerEntries: [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g1", "u-bob")],
      usernames,
      activeThresholdPct: 50,
    });

    expect(active.map((r) => r.username)).toEqual(["alice"]);
    expect(inactive.map((r) => r.username)).toEqual(["bob"]);
  });

  it("treats a player who just played their first closed game as active", () => {
    const { active } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2)],
      ledgerEntries: [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g2", "u-bob")],
      usernames,
      activeThresholdPct: 50,
    });

    expect(names(active)).toEqual(["alice", "bob"]);
  });

  it("treats a player just over the threshold as active", () => {
    const { active } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2), closedOn("g3", 3)],
      ledgerEntries: [buyIn("g1", "u-bob"), buyIn("g3", "u-bob")],
      usernames,
      activeThresholdPct: 50,
    });

    expect(active.map((r) => r.username)).toEqual(["bob"]);
  });

  it("counts activity from a player's first game, so late joiners are not penalised", () => {
    const { active } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2), closedOn("g3", 3), closedOn("g4", 4)],
      ledgerEntries: [
        buyIn("g1", "u-alice"),
        buyIn("g2", "u-alice"),
        buyIn("g3", "u-alice"),
        buyIn("g4", "u-alice"),
        buyIn("g3", "u-bob"),
        buyIn("g4", "u-bob"),
      ],
      usernames,
      activeThresholdPct: 50,
    });

    expect(names(active)).toEqual(["alice", "bob"]);
  });

  it("keeps a player who stopped coming active until their share falls to the threshold", () => {
    const veteran = [buyIn("g1", "u-alice"), buyIn("g2", "u-alice"), buyIn("g3", "u-alice")];
    const games = [1, 2, 3, 4, 5, 6].map((d) => closedOn(`g${d}`, d));

    const afterFive = computeLeagueStandings({
      closedGames: games.slice(0, 5),
      ledgerEntries: veteran,
      usernames,
      activeThresholdPct: 50,
    });
    const afterSix = computeLeagueStandings({
      closedGames: games,
      ledgerEntries: veteran,
      usernames,
      activeThresholdPct: 50,
    });

    expect(afterFive.active.map((r) => r.username)).toEqual(["alice"]);
    expect(afterSix.inactive.map((r) => r.username)).toEqual(["alice"]);
  });

  it("ranks inactive players by lifetime net too", () => {
    const { inactive } = computeLeagueStandings({
      closedGames: [closedOn("g1", 1), closedOn("g2", 2), closedOn("g3", 3)],
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
      activeThresholdPct: 50,
    });

    expect(inactive.map((r) => r.username)).toEqual(["Bob", "carol", "alice"]);
  });

  it("orders closed games by close time, falling back to creation time", () => {
    const late = { id: "g-late", closedAt: null, createdAt: new Date(Date.UTC(2026, 9, 3)) };
    const { active } = computeLeagueStandings({
      closedGames: [late, closedOn("g2", 2), closedOn("g1", 1)],
      ledgerEntries: [buyIn("g-late", "u-bob")],
      usernames,
      activeThresholdPct: 50,
    });

    expect(active.map((r) => r.username)).toEqual(["bob"]);
  });

  it("applies the league's activity threshold", () => {
    const input = {
      closedGames: [1, 2, 3, 4].map((d) => closedOn(`g${d}`, d)),
      ledgerEntries: [buyIn("g1", "u-bob"), buyIn("g2", "u-bob"), buyIn("g3", "u-bob")],
      usernames,
    };

    expect(names(computeLeagueStandings({ ...input, activeThresholdPct: 50 }).active)).toEqual(["bob"]);
    expect(names(computeLeagueStandings({ ...input, activeThresholdPct: 75 }).inactive)).toEqual(["bob"]);
  });

  it("is empty when there are no closed games", () => {
    expect(
      computeLeagueStandings({
        closedGames: [],
        ledgerEntries: [],
        usernames: new Map(),
        activeThresholdPct: 50,
      })
    ).toEqual({ active: [], inactive: [] });
  });
});
