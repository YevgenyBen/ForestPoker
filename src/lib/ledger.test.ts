import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { latestLiveEntryQuery, liveLedgerQuery } from "./ledger";

const srcDir = fileURLToPath(new URL("..", import.meta.url));

/** Source files (relative to src/, forward slashes), excluding tests. */
function sourceFiles() {
  return readdirSync(srcDir, { recursive: true, encoding: "utf8" })
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
}

describe("ledger reads", () => {
  it("only src/lib/ledger.ts reads ledger entries, so voided entries can't slip into a total", () => {
    const offenders = sourceFiles().filter((f) => {
      if (f === "lib/ledger.ts" || f === "db/schema.ts") return false;
      const code = readFileSync(join(srcDir, f), "utf8");
      return /\.from\(\s*ledgerEntries\b/.test(code) || /\bledger_entries\b/.test(code);
    });
    expect(
      offenders,
      `Read ledger entries through src/lib/ledger.ts instead (from ${relative(process.cwd(), srcDir)})`
    ).toEqual([]);
  });

  it("leaves out voided entries when listing a game's entries", () => {
    const { sql } = liveLedgerQuery(db, { gameIds: ["g1"] }).toSQL();
    expect(sql).toContain('"ledger_entries"."voided_at" is null');
  });

  it("leaves out voided entries when listing one player's entries", () => {
    const { sql, params } = liveLedgerQuery(db, {
      gameIds: ["g1", "g2"],
      userId: "u-alice",
    }).toSQL();
    expect(sql).toContain('"ledger_entries"."voided_at" is null');
    expect(sql).toContain('"ledger_entries"."user_id" = ');
    expect(params).toContain("u-alice");
  });

  it("finds the latest entry to undo among live entries only, newest first", () => {
    const { sql } = latestLiveEntryQuery(db, "g1", "u-alice").toSQL();
    expect(sql).toContain('"ledger_entries"."voided_at" is null');
    expect(sql).toMatch(/order by "ledger_entries"\."recorded_at" desc/);
    expect(sql).toMatch(/limit \$\d+$/);
  });
});
