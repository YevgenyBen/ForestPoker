import { isNull } from "drizzle-orm";
import { ledgerEntries } from "@/db/schema";

/**
 * Where-clause for ledger entries that count. Every ledger read must include it:
 * a voided (undone) entry stays on record but counts for nothing — not the bank,
 * totals, lifetime net, or whether the player played.
 */
export const notVoided = isNull(ledgerEntries.voidedAt);
