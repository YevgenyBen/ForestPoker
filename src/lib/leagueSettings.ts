import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leagueSettings } from "@/db/schema";
import { DEFAULT_ACTIVE_THRESHOLD_PCT } from "@/lib/leagueStandings";

const LEAGUE_SETTINGS_ROW_ID = 1;

export type LeagueSettings = {
  activeThresholdPct: number;
};

/** League-wide settings; defaults apply until the settings row exists. */
export async function getLeagueSettings(): Promise<LeagueSettings> {
  const [row] = await db
    .select({ activeThresholdPct: leagueSettings.activeThresholdPct })
    .from(leagueSettings)
    .where(eq(leagueSettings.id, LEAGUE_SETTINGS_ROW_ID))
    .limit(1);

  return {
    activeThresholdPct: row?.activeThresholdPct ?? DEFAULT_ACTIVE_THRESHOLD_PCT,
  };
}
