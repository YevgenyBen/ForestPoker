export type SettlementLine = {
  fromName: string;
  toName: string;
  amountNis: number;
};

export type SettlementMessageInput = {
  title: string;
  transfers: SettlementLine[];
  closerName?: string | null;
};

/** Keep mixed Hebrew/Latin lines in correct visual order in WhatsApp (BiDi). */
const LRI = "\u2066";
const PDI = "\u2069";

const money = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

export function formatSettlementMessage(input: SettlementMessageInput): string {
  const lines: string[] = [`🃏 Forest Poker`, input.title, "", "התחשבנות:"];

  if (input.transfers.length === 0) {
    lines.push("אין התחשבנות — כולם מאוזנים");
  } else {
    for (const t of input.transfers) {
      lines.push(
        `${LRI}${t.fromName} → ${t.toName}: ${money(t.amountNis)}${PDI}`
      );
    }
  }

  if (input.closerName) {
    lines.push("", `נסגר על ידי: ${LRI}${input.closerName}${PDI}`);
  }

  return lines.join("\n");
}
