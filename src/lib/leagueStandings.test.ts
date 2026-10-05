import { describe, expect, it } from "vitest";
import { computeLeagueStandings } from "./leagueStandings";

const usernames = new Map([
  ["u-alice", "alice"],
  ["u-bob", "bob"],
]);

describe("league standings", () => {
  it("gives each player their lifetime net: buy-outs minus buy-ins across closed games", () => {
    const rows = computeLeagueStandings({
      playerIds: ["u-alice", "u-bob"],
      ledgerEntries: [
        { gameId: "g1", userId: "u-alice", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-alice", kind: "buy_out", amountNis: 250 },
        { gameId: "g2", userId: "u-alice", kind: "buy_in", amountNis: 100 },
        { gameId: "g1", userId: "u-bob", kind: "buy_in", amountNis: 200 },
        { gameId: "g2", userId: "u-bob", kind: "buy_out", amountNis: 30 },
      ],
      usernames,
    });

    expect(rows).toEqual([
      { userId: "u-alice", username: "alice", lifetimeNetNis: 50 },
      { userId: "u-bob", username: "bob", lifetimeNetNis: -170 },
    ]);
  });

  it("ranks by lifetime net, highest first, breaking ties alphabetically ignoring case", () => {
    const rows = computeLeagueStandings({
      playerIds: ["u-loser", "u-zed", "u-amy", "u-winner"],
      ledgerEntries: [
        { gameId: "g1", userId: "u-loser", kind: "buy_in", amountNis: 300 },
        { gameId: "g1", userId: "u-zed", kind: "buy_out", amountNis: 40 },
        { gameId: "g1", userId: "u-amy", kind: "buy_out", amountNis: 40 },
        { gameId: "g1", userId: "u-winner", kind: "buy_out", amountNis: 220 },
      ],
      usernames: new Map([
        ["u-loser", "Loser"],
        ["u-zed", "Zed"],
        ["u-amy", "amy"],
        ["u-winner", "Winner"],
      ]),
    });

    expect(rows.map((r) => r.username)).toEqual(["Winner", "amy", "Zed", "Loser"]);
  });

  it("is empty when there are no closed games", () => {
    expect(
      computeLeagueStandings({ playerIds: [], ledgerEntries: [], usernames: new Map() })
    ).toEqual([]);
  });
});
