# Forest Poker

A home-game poker group's companion app: scheduling games, recording buy-ins and buy-outs, settling up, and tracking how everyone does over time.

## Games

**Closed game**:
A game whose play has finished and whose ledger is final; only closed games count toward standings and activity.
_Avoid_: Finished game, past game

**Played (a game)**:
A player played a game if they bought in at least once in it; joining a game without buying in is not playing it.
_Avoid_: Attended, participated

## Ledger

**Ledger entry**:
A single buy-in or buy-out that a player records for themselves in an open game.
_Avoid_: Transaction, row

**Buy-in**:
A ledger entry for money a player puts into the game's bank; every rebuy is just another buy-in.
_Avoid_: Rebuy, top-up

**Buy-out**:
A ledger entry for the full amount a player takes back out of the game's bank, not their profit.
_Avoid_: Cash-out, profit

**Undo (a ledger entry)**:
A player taking back their own most recent ledger entry that hasn't already been undone, while the game is still open. Repeating it walks further back through their entries.
_Avoid_: Delete entry, cancel entry, edit entry

**Voided entry**:
A ledger entry that was undone. It stays on record but counts for nothing: not the bank, not totals or lifetime net, and not whether the player played the game.
_Avoid_: Deleted entry, cancelled entry

## League

**League standings**:
The ranking of players by lifetime net across all closed games.
_Avoid_: Leaderboard, season standings

**Lifetime net**:
A player's total buy-outs minus total buy-ins across all closed games.
_Avoid_: Total winnings, balance

**Active player**:
A player who played more than the activity threshold of the closed games held since the first closed game they played (that first game included). Activity decides where a player is listed in the standings, never what their lifetime net is.
_Avoid_: Regular, current player

**Activity threshold**:
The league setting for the share of games a player must exceed to count as an active player; half by default.
_Avoid_: Attendance rate, activity cutoff

**Inactive player**:
A player who has played at least one closed game but is not an active player; still part of the league and its history, just listed separately.
_Avoid_: Archived player, removed player, former player
