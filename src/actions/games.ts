"use server";

import { z } from "zod";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  appUsers,
  gameMembers,
  gameRsvps,
  games,
  ledgerEntries,
  settlements,
} from "@/db/schema";
import { getViewer } from "@/lib/auth/session";
import { canDeleteGames } from "@/lib/auth/gameAdmin";
import {
  computeNetByUser,
  minimizeTransfers,
  netSum,
  type Transfer,
} from "@/lib/settlement";
import { notifyGameSettlements } from "@/lib/whatsapp/notifyGameSettlements";
import { safeConsoleError } from "@/lib/logSafeError";
import { formatDateDdMmYyyy, parseScheduledCalendarDate } from "@/lib/formatDate";

const amountSchema = z.coerce.number().int().positive();

const notesSchema = z.string().max(500).optional();
const gameLocationSchema = z.string().max(500).optional();

/** Next game serial = existing row count + 1; title `Game {n} - dd/mm/yyyy` (Israel date). */
function nextGameTitle(existingCount: number, at = new Date()) {
  const serial = existingCount + 1;
  return `Game ${serial} - ${formatDateDdMmYyyy(at)}`;
}

async function requireUser() {
  const locale = await getLocale();
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);
  return { user: v.user, locale };
}

export async function createGame(formData: FormData) {
  const { user, locale } = await requireUser();

  const dateRaw = formData.get("scheduled_date")?.toString() ?? "";
  const notesRaw = formData.get("notes")?.toString() ?? "";
  const locationRaw = formData.get("location")?.toString() ?? "";
  const scheduledStart = parseScheduledCalendarDate(dateRaw);
  if (!scheduledStart) {
    redirect(`/${locale}/games`);
  }

  const notesResult = notesSchema.safeParse(notesRaw.trim() || undefined);
  const notes = notesResult.success ? (notesResult.data ?? null) : null;

  const locationResult = gameLocationSchema.safeParse(
    locationRaw.trim() || undefined
  );
  const location = locationResult.success
    ? (locationResult.data ?? null)
    : null;

  const [row] = await db.select({ n: count() }).from(games);
  const title = nextGameTitle(Number(row?.n ?? 0), scheduledStart);

  const [game] = await db
    .insert(games)
    .values({
      title,
      createdBy: user.id,
      status: "scheduled",
      scheduledStartAt: scheduledStart,
      notes,
      location,
    })
    .returning({ id: games.id });

  await db.insert(gameMembers).values({
    gameId: game!.id,
    userId: user.id,
  });

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/league`);
  redirect(`/${locale}/games/${game!.id}`);
}

export async function openGame(gameId: string) {
  const { user, locale } = await requireUser();

  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g || g.status !== "scheduled") {
    return { error: "bad_state" as const };
  }

  if (g.createdBy !== user.id) return { error: "forbidden" as const };

  await db
    .update(games)
    .set({ status: "open" })
    .where(eq(games.id, gameId));

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

const rsvpStatusSchema = z.enum(["yes", "maybe", "no"]);

export async function setGameRsvp(gameId: string, status: string) {
  const { user, locale } = await requireUser();
  const parsed = rsvpStatusSchema.safeParse(status);
  if (!parsed.success) return { error: "invalid" as const };

  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g || g.status !== "scheduled") return { error: "bad_state" as const };

  await db
    .insert(gameRsvps)
    .values({
      gameId,
      userId: user.id,
      status: parsed.data,
    })
    .onConflictDoUpdate({
      target: [gameRsvps.gameId, gameRsvps.userId],
      set: {
        status: parsed.data,
        updatedAt: new Date(),
      },
    });

  await db.insert(gameMembers).values({ gameId, userId: user.id }).onConflictDoNothing();

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

export async function joinGame(gameId: string) {
  const { user, locale } = await requireUser();

  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g || (g.status !== "open" && g.status !== "scheduled")) {
    return { error: "closed" as const };
  }

  await db.insert(gameMembers).values({ gameId, userId: user.id }).onConflictDoNothing();

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  return { ok: true as const };
}

export async function addLedgerEntry(input: {
  gameId: string;
  kind: "buy_in" | "buy_out";
  amountNis: number;
}) {
  const { user, locale } = await requireUser();
  const amount = amountSchema.safeParse(input.amountNis);
  if (!amount.success) return { error: "invalid_amount" as const };

  const [g] = await db.select().from(games).where(eq(games.id, input.gameId)).limit(1);
  if (!g || g.status !== "open") return { error: "closed" as const };

  const [member] = await db
    .select()
    .from(gameMembers)
    .where(
      and(eq(gameMembers.gameId, input.gameId), eq(gameMembers.userId, user.id))
    )
    .limit(1);
  if (!member) return { error: "not_member" as const };

  await db.insert(ledgerEntries).values({
    gameId: input.gameId,
    userId: user.id,
    kind: input.kind,
    amountNis: amount.data,
    note: null,
  });

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${input.gameId}`);
  revalidatePath(`/${locale}/career`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

export async function closeGame(gameId: string) {
  const { user, locale } = await requireUser();

  let notifyPayload: {
    title: string;
    transfers: Transfer[];
    closerUsername: string;
  } | null = null;

  try {
    await db.transaction(async (tx) => {
      const [g] = await tx
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .for("update")
        .limit(1);

      if (!g) throw new Error("not_found");
      if (g.status !== "open") throw new Error("already_closed");

      const [member] = await tx
        .select()
        .from(gameMembers)
        .where(
          and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, user.id))
        )
        .limit(1);
      if (!member) throw new Error("not_member");

      const ledger = await tx
        .select({
          userId: ledgerEntries.userId,
          kind: ledgerEntries.kind,
          amountNis: ledgerEntries.amountNis,
        })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.gameId, gameId));

      const netByUser = computeNetByUser(ledger);
      const sum = netSum(netByUser);
      if (sum !== 0) throw new Error("bad_balance");

      const transfers = minimizeTransfers(netByUser);

      await tx
        .update(games)
        .set({
          status: "closed",
          closedAt: new Date(),
          closedBy: user.id,
        })
        .where(eq(games.id, gameId));

      if (transfers.length) {
        await tx.insert(settlements).values(
          transfers.map((t) => ({
            gameId,
            fromUserId: t.fromUserId,
            toUserId: t.toUserId,
            amountNis: t.amountNis,
          }))
        );
      }

      notifyPayload = {
        title: g.title,
        transfers,
        closerUsername: user.username,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "already_closed") return { error: "already_closed" as const };
    if (msg === "bad_balance") return { error: "bad_balance" as const };
    if (msg === "not_member") return { error: "not_member" as const };
    safeConsoleError("games:closeGame", e);
    throw e;
  }

  if (notifyPayload) {
    try {
      await notifyGameSettlements(gameId, notifyPayload);
    } catch (e) {
      safeConsoleError("games:whatsappNotify", e);
    }
  }

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  revalidatePath(`/${locale}/career`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

export async function deleteGame(gameId: string) {
  const { user, locale } = await requireUser();

  if (!canDeleteGames(user.email)) {
    return { error: "forbidden" as const };
  }

  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g) return { error: "not_found" as const };

  await db.delete(games).where(eq(games.id, gameId));

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  revalidatePath(`/${locale}/career`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

/** Remove a scheduled game entirely (host or game admin). */
export async function cancelScheduledGame(gameId: string) {
  const { user, locale } = await requireUser();

  const [g] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!g) return { error: "not_found" as const };
  if (g.status !== "scheduled") return { error: "bad_state" as const };

  const isHost = g.createdBy === user.id;
  if (!isHost && !canDeleteGames(user.email)) {
    return { error: "forbidden" as const };
  }

  await db.delete(games).where(eq(games.id, gameId));

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/games/${gameId}`);
  revalidatePath(`/${locale}/career`);
  revalidatePath(`/${locale}/league`);
  return { ok: true as const };
}

export type ListedGameRow = {
  id: string;
  title: string;
  status: "scheduled" | "open" | "closed";
  createdAt: Date;
  closedAt: Date | null;
  scheduledStartAt: Date | null;
  notes: string | null;
  gameLocation: string | null;
  createdBy: string;
  initiatorUsername: string;
  initiatorLocation: string | null;
};

export async function listGamesBySection() {
  await requireUser();
  const initiator = alias(appUsers, "initiator");

  const rows = await db
    .select({
      id: games.id,
      title: games.title,
      status: games.status,
      createdAt: games.createdAt,
      closedAt: games.closedAt,
      scheduledStartAt: games.scheduledStartAt,
      notes: games.notes,
      gameLocation: games.location,
      createdBy: games.createdBy,
      initiatorUsername: initiator.username,
      initiatorLocation: initiator.location,
    })
    .from(games)
    .innerJoin(initiator, eq(games.createdBy, initiator.id))
    .orderBy(desc(games.createdAt));

  const upcoming = rows
    .filter((r) => r.status === "scheduled")
    .sort(
      (a, b) =>
        (a.scheduledStartAt?.getTime() ?? 0) -
        (b.scheduledStartAt?.getTime() ?? 0)
    ) as ListedGameRow[];

  const current = rows
    .filter((r) => r.status === "open")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as ListedGameRow[];

  const past = rows
    .filter((r) => r.status === "closed")
    .sort(
      (a, b) =>
        (b.closedAt?.getTime() ?? b.createdAt.getTime()) -
        (a.closedAt?.getTime() ?? a.createdAt.getTime())
    ) as ListedGameRow[];

  return { upcoming, current, past };
}

export async function getGameDetail(gameId: string) {
  const { user } = await requireUser();

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return null;

  const members = await db
    .select({
      userId: appUsers.id,
      username: appUsers.username,
      joinedAt: gameMembers.joinedAt,
    })
    .from(gameMembers)
    .innerJoin(appUsers, eq(gameMembers.userId, appUsers.id))
    .where(eq(gameMembers.gameId, gameId));

  let ledgerRows: {
    userId: string;
    kind: "buy_in" | "buy_out";
    amountNis: number;
  }[] = [];
  if (game.status !== "scheduled") {
    ledgerRows = await db
      .select({
        userId: ledgerEntries.userId,
        kind: ledgerEntries.kind,
        amountNis: ledgerEntries.amountNis,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.gameId, gameId));
  }

  const buyInByUser = new Map<string, number>();
  const buyOutByUser = new Map<string, number>();
  for (const row of ledgerRows) {
    if (row.kind === "buy_in") {
      buyInByUser.set(
        row.userId,
        (buyInByUser.get(row.userId) ?? 0) + row.amountNis
      );
    } else {
      buyOutByUser.set(
        row.userId,
        (buyOutByUser.get(row.userId) ?? 0) + row.amountNis
      );
    }
  }

  const membersWithTotals = members.map((m) => ({
    ...m,
    buyInTotalNis: buyInByUser.get(m.userId) ?? 0,
    buyOutTotalNis: buyOutByUser.get(m.userId) ?? 0,
  }));

  type RsvpPerson = { userId: string; username: string };

  let rsvp: { yes: RsvpPerson[]; maybe: RsvpPerson[]; no: RsvpPerson[] } | null =
    null;
  let myRsvp: "yes" | "maybe" | "no" | null = null;

  if (game.status === "scheduled") {
    const rsvpRows = await db
      .select({
        userId: gameRsvps.userId,
        username: appUsers.username,
        status: gameRsvps.status,
      })
      .from(gameRsvps)
      .innerJoin(appUsers, eq(gameRsvps.userId, appUsers.id))
      .where(eq(gameRsvps.gameId, gameId));

    const yes: RsvpPerson[] = [];
    const maybe: RsvpPerson[] = [];
    const no: RsvpPerson[] = [];
    const sortNames = (a: RsvpPerson, b: RsvpPerson) =>
      a.username.localeCompare(b.username, undefined, { sensitivity: "base" });

    for (const r of rsvpRows) {
      const row: RsvpPerson = { userId: r.userId, username: r.username };
      if (r.status === "yes") yes.push(row);
      else if (r.status === "maybe") maybe.push(row);
      else no.push(row);
    }
    yes.sort(sortNames);
    maybe.sort(sortNames);
    no.sort(sortNames);
    rsvp = { yes, maybe, no };

    const mine = rsvpRows.find((r) => r.userId === user.id);
    myRsvp = mine ? mine.status : null;
  }

  const isMember = members.some((m) => m.userId === user.id);

  const bankNis = ledgerRows.reduce(
    (sum, row) =>
      sum + (row.kind === "buy_in" ? row.amountNis : -row.amountNis),
    0
  );

  let settlementRows: {
    fromUserId: string;
    toUserId: string;
    amountNis: number;
    fromName: string;
    toName: string;
  }[] = [];

  if (game.status === "closed") {
    const rows = await db
      .select({
        fromUserId: settlements.fromUserId,
        toUserId: settlements.toUserId,
        amountNis: settlements.amountNis,
      })
      .from(settlements)
      .where(eq(settlements.gameId, gameId));

    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.fromUserId);
      ids.add(r.toUserId);
    }
    const idList = [...ids];
    const names =
      idList.length === 0
        ? []
        : await db
            .select({ id: appUsers.id, username: appUsers.username })
            .from(appUsers)
            .where(inArray(appUsers.id, idList));

    const nameMap = new Map(names.map((n) => [n.id, n.username]));
    settlementRows = rows.map((r) => ({
      ...r,
      fromName: nameMap.get(r.fromUserId) ?? "?",
      toName: nameMap.get(r.toUserId) ?? "?",
    }));
  }

  let closerName: string | null = null;
  if (game.closedBy) {
    const [cr] = await db
      .select({ username: appUsers.username })
      .from(appUsers)
      .where(eq(appUsers.id, game.closedBy))
      .limit(1);
    closerName = cr?.username ?? null;
  }

  const [initiator] = await db
    .select({
      username: appUsers.username,
      location: appUsers.location,
    })
    .from(appUsers)
    .where(eq(appUsers.id, game.createdBy))
    .limit(1);

  return {
    game,
    members: membersWithTotals,
    bankNis,
    settlements: settlementRows,
    closerName,
    isMember,
    initiatorUsername: initiator?.username ?? "?",
    initiatorLocation: initiator?.location ?? null,
    rsvp,
    myRsvp,
  };
}

export async function getCareerSummary() {
  const { user } = await requireUser();

  const joined = await db
    .select({ gameId: gameMembers.gameId })
    .from(gameMembers)
    .where(eq(gameMembers.userId, user.id));

  const gameIds = joined.map((j) => j.gameId);
  if (gameIds.length === 0) {
    return { lifetimeNis: 0, rows: [] as { gameId: string; title: string; closedAt: Date | null; netNis: number }[] };
  }

  const closedGames = await db
    .select()
    .from(games)
    .where(and(inArray(games.id, gameIds), eq(games.status, "closed")));

  const ledgerForUser = await db
    .select({
      gameId: ledgerEntries.gameId,
      kind: ledgerEntries.kind,
      amountNis: ledgerEntries.amountNis,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, user.id),
        inArray(ledgerEntries.gameId, gameIds)
      )
    );

  const netByGame = new Map<string, number>();
  for (const row of ledgerForUser) {
    const delta =
      row.kind === "buy_out" ? row.amountNis : -row.amountNis;
    netByGame.set(row.gameId, (netByGame.get(row.gameId) ?? 0) + delta);
  }

  let lifetime = 0;
  const rows: {
    gameId: string;
    title: string;
    closedAt: Date | null;
    netNis: number;
  }[] = [];

  for (const g of closedGames) {
    const net = netByGame.get(g.id) ?? 0;
    lifetime += net;
    rows.push({
      gameId: g.id,
      title: g.title,
      closedAt: g.closedAt,
      netNis: net,
    });
  }

  rows.sort((a, b) => {
    const ta = a.closedAt?.getTime() ?? 0;
    const tb = b.closedAt?.getTime() ?? 0;
    return ta - tb;
  });

  return { lifetimeNis: lifetime, rows };
}

/** Lifetime net per player across closed games only (same rules as career net). */
export async function getLeagueStandings() {
  await requireUser();

  const closedRows = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.status, "closed"));

  const closedIds = closedRows.map((r) => r.id);
  if (closedIds.length === 0) {
    return {
      rows: [] as { userId: string; username: string; totalNis: number }[],
    };
  }

  const memberRows = await db
    .select({ userId: gameMembers.userId })
    .from(gameMembers)
    .where(inArray(gameMembers.gameId, closedIds));

  const totals = new Map<string, number>();
  for (const m of memberRows) {
    totals.set(m.userId, 0);
  }

  const ledgerRows = await db
    .select({
      userId: ledgerEntries.userId,
      kind: ledgerEntries.kind,
      amountNis: ledgerEntries.amountNis,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.gameId, closedIds));

  for (const row of ledgerRows) {
    const delta =
      row.kind === "buy_out" ? row.amountNis : -row.amountNis;
    totals.set(row.userId, (totals.get(row.userId) ?? 0) + delta);
  }

  const userIds = [...totals.keys()];
  if (userIds.length === 0) {
    return { rows: [] as { userId: string; username: string; totalNis: number }[] };
  }

  const usersRows = await db
    .select({
      id: appUsers.id,
      username: appUsers.username,
    })
    .from(appUsers)
    .where(inArray(appUsers.id, userIds));

  const byId = new Map(usersRows.map((u) => [u.id, u.username]));

  const rows = userIds
    .map((id) => ({
      userId: id,
      username: byId.get(id) ?? id,
      totalNis: totals.get(id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.totalNis !== a.totalNis) return b.totalNis - a.totalNis;
      return a.username.localeCompare(b.username, undefined, {
        sensitivity: "base",
      });
    });

  return { rows };
}
