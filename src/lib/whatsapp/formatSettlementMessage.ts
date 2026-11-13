import { localizeGameTitle } from "@/lib/gameTitle";

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

/**
 * BiDi controls so the Hebrew message reads right-to-left in WhatsApp:
 * - every line starts with RLM, forcing an RTL paragraph (consistent right alignment);
 * - every user-supplied string (names, title) sits in a first-strong isolate, so a
 *   Hebrew or Latin name keeps its own direction and never swaps places with its
 *   neighbours.
 */
const RLM = "‏";
const FSI = "⁨";
const PDI = "⁩";

const iso = (s: string) => `${FSI}${s}${PDI}`;

/** In an RTL line "payer ← payee" reads right-to-left with the arrow pointing at the payee. */
const ARROW = "←";

const money = (n: number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);

export function formatSettlementMessage(input: SettlementMessageInput): string {
  const lines: string[] = [iso("🃏 Forest Poker"), iso(localizeGameTitle(input.title, ({ serial, date }) => `משחק ${serial} - ${date}`)), "", "התחשבנות:"];

  if (input.transfers.length === 0) {
    lines.push("אין התחשבנות — כולם מאוזנים");
  } else {
    for (const t of input.transfers) {
      lines.push(`${iso(t.fromName)} ${ARROW} ${iso(t.toName)}: ${money(t.amountNis)}`);
    }
  }

  if (input.closerName) {
    lines.push("", `נסגר על ידי: ${iso(input.closerName)}`);
  }

  return lines.map((line) => (line ? `${RLM}${line}` : line)).join("\n");
}
