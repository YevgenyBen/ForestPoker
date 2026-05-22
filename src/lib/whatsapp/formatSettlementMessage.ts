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
      lines.push(`${t.fromName} → ${t.toName}: ${money(t.amountNis)}`);
    }
  }

  if (input.closerName) {
    lines.push("", `נסגר על ידי: ${input.closerName}`);
  }

  return lines.join("\n");
}
