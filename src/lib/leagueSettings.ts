import { eq } from "drizzle-orm";
import { db } from "@/db";
import { leagueSettings } from "@/db/schema";

const LEAGUE_SETTINGS_ROW_ID = 1;

/** Activity threshold used until the league sets its own (matches the column default). */
export const DEFAULT_ACTIVITY_THRESHOLD_PCT = 50;

export type LeagueSettings = {
  activityThresholdPct: number;
};

/** League-wide settings; defaults apply until the settings row exists. */
export async function getLeagueSettings(): Promise<LeagueSettings> {
  const [row] = await db
    .select({ activityThresholdPct: leagueSettings.activityThresholdPct })
    .from(leagueSettings)
    .where(eq(leagueSettings.id, LEAGUE_SETTINGS_ROW_ID))
    .limit(1);

  return {
    activityThresholdPct: row?.activityThresholdPct ?? DEFAULT_ACTIVITY_THRESHOLD_PCT,
  };
}
