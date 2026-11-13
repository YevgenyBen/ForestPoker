import { describe, expect, it } from "vitest";
import {
  formatStoredGameTitle,
  localizeGameTitle,
  parseStoredGameTitle,
} from "./gameTitle";

describe("game titles", () => {
  it("round-trips the stored form", () => {
    const stored = formatStoredGameTitle(14, "12/11/2026");
    expect(stored).toBe("Game 14 - 12/11/2026");
    expect(parseStoredGameTitle(stored)).toEqual({ serial: 14, date: "12/11/2026" });
  });

  it("localizes stored titles", () => {
    expect(
      localizeGameTitle("Game 3 - 01/02/2026", ({ serial, date }) => `משחק ${serial} - ${date}`)
    ).toBe("משחק 3 - 01/02/2026");
  });

  it("leaves custom titles untouched", () => {
    expect(localizeGameTitle("Friday special", () => "x")).toBe("Friday special");
    expect(parseStoredGameTitle("Game three - 01/02/2026")).toBeNull();
  });
});
