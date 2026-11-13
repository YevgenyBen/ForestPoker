import { describe, expect, it } from "vitest";
import { formatSettlementMessage } from "./formatSettlementMessage";

const RLM = "‏";
const FSI = "⁨";
const PDI = "⁩";

const strip = (s: string) => s.replace(/[‎‏⁦-⁩]/g, "").replace(/ /g, " ");

describe("formatSettlementMessage", () => {
  const msg = formatSettlementMessage({
    title: "Game 14 - 12/11/2026",
    transfers: [
      { fromName: "ITZIK_A", toName: "טלסקורי", amountNis: 130 },
      { fromName: "בוגיס", toName: "טלסקורי", amountNis: 50 },
    ],
    closerName: "Yevgeny",
  });

  it("reads correctly once direction marks are removed", () => {
    expect(strip(msg)).toBe(
      [
        "🃏 Forest Poker",
        "Game 14 - 12/11/2026",
        "",
        "התחשבנות:",
        "ITZIK_A ← טלסקורי: 130 ₪",
        "בוגיס ← טלסקורי: 50 ₪",
        "",
        "נסגר על ידי: Yevgeny",
      ].join("\n")
    );
  });

  it("starts every non-empty line as an RTL paragraph", () => {
    for (const line of msg.split("\n")) {
      if (line) expect(line.startsWith(RLM)).toBe(true);
    }
  });

  it("isolates each name so Hebrew names don't swap around the arrow", () => {
    expect(msg).toContain(`${FSI}בוגיס${PDI} ← ${FSI}טלסקורי${PDI}`);
    expect(msg).toContain(`${FSI}Yevgeny${PDI}`);
  });
});
