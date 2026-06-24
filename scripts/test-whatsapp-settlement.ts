import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { appUsers, games, settlements } from "../src/db/schema";
import { notifyGameSettlements } from "../src/lib/whatsapp/notifyGameSettlements";
import { isWhatsAppNotifyConfigured } from "../src/lib/whatsapp/sendTwilioWhatsApp";

async function main() {
  if (!isWhatsAppNotifyConfigured()) {
    console.error("Twilio WhatsApp env vars are not configured in .env");
    process.exit(1);
  }

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.status, "closed"))
    .orderBy(desc(games.closedAt))
    .limit(1);

  if (!game) {
    console.error("No closed games found");
    process.exit(1);
  }

  const transfers = await db
    .select({
      fromUserId: settlements.fromUserId,
      toUserId: settlements.toUserId,
      amountNis: settlements.amountNis,
    })
    .from(settlements)
    .where(eq(settlements.gameId, game.id));

  let closerUsername = "?";
  if (game.closedBy) {
    const [closer] = await db
      .select({ username: appUsers.username })
      .from(appUsers)
      .where(eq(appUsers.id, game.closedBy))
      .limit(1);
    if (closer) closerUsername = closer.username;
  }

  console.log(
    `Sending test WhatsApp for "${game.title}" (${transfers.length} transfers)...`
  );
  await notifyGameSettlements(game.id, {
    title: game.title,
    transfers,
    closerUsername,
  });
  console.log("Done — check WhatsApp.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
