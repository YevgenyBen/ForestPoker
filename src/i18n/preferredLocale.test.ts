import { describe, expect, it } from "vitest";
import { preferredLocale } from "./preferredLocale";

const locales = ["en", "he"] as const;

describe("preferredLocale", () => {
  it("falls back when the header is missing", () => {
    expect(preferredLocale(null, locales, "en")).toBe("en");
  });

  it("matches on the primary subtag", () => {
    expect(preferredLocale("he-IL,he;q=0.9,en;q=0.8", locales, "en")).toBe("he");
  });

  it("respects q-values over order", () => {
    expect(preferredLocale("en;q=0.5,he;q=0.9", locales, "en")).toBe("he");
  });

  it("maps legacy iw to he", () => {
    expect(preferredLocale("iw", locales, "en")).toBe("he");
  });

  it("skips unsupported languages", () => {
    expect(preferredLocale("fr-FR,fr;q=0.9,he;q=0.5", locales, "en")).toBe("he");
    expect(preferredLocale("fr", locales, "en")).toBe("en");
  });
});
