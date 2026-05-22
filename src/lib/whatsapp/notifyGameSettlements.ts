import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import type { Transfer } from "@/lib/settlement";
import { formatSettlementMessage } from "@/lib/whatsapp/formatSettlementMessage";
import {
  isWhatsAppNotifyConfigured,
  sendTwilioWhatsApp,
} from "@/lib/whatsapp/sendTwilioWhatsApp";

export type NotifyGameSettlementsPayload = {
  title: string;
  transfers: Transfer[];
  closerUsername: string;
};

export async function notifyGameSettlements(
  _gameId: string,
  payload: NotifyGameSettlementsPayload
): Promise<void> {
  if (!isWhatsAppNotifyConfigured()) return;

  const ids = new Set<string>();
  for (const t of payload.transfers) {
    ids.add(t.fromUserId);
    ids.add(t.toUserId);
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

  const body = formatSettlementMessage({
    title: payload.title,
    transfers: payload.transfers.map((t) => ({
      fromName: nameMap.get(t.fromUserId) ?? "?",
      toName: nameMap.get(t.toUserId) ?? "?",
      amountNis: t.amountNis,
    })),
    closerName: payload.closerUsername,
  });

  await sendTwilioWhatsApp(body);
}
