"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { getViewer } from "@/lib/auth/session";
import { safeConsoleError } from "@/lib/logSafeError";
import { usernameSchema } from "@/lib/username";
import { bumpSyncVersion } from "@/lib/sync/bump";

export type UpdateProfileState =
  | null
  | { ok: true }
  | {
      error:
        | "invalid_username"
        | "invalid_location"
        | "taken"
        | "failed";
    };

export async function updatePlayerProfile(
  _prev: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const locale = await getLocale();
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);

  const user = v.user;

  const userParsed = usernameSchema.safeParse(formData.get("username"));
  if (!userParsed.success) return { error: "invalid_username" };

  const locRaw = formData.get("location")?.toString().trim() ?? "";
  if (locRaw.length > 500) return { error: "invalid_location" };
  const location = locRaw === "" ? null : locRaw;

  const username = userParsed.data;

  try {
    const usernameChanged =
      username.toLowerCase() !== user.username.toLowerCase();

    if (usernameChanged) {
      const [conflict] = await db
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(
          and(
            sql`lower(${appUsers.username}) = lower(${username})`,
            ne(appUsers.id, user.id)
          )
        )
        .limit(1);
      if (conflict) return { error: "taken" };
    }

    await db
      .update(appUsers)
      .set({
        username,
        location,
      })
      .where(eq(appUsers.id, user.id));
  } catch (e) {
    safeConsoleError("player:updateProfile", e);
    return { error: "failed" };
  }

  await bumpSyncVersion(db);

  revalidatePath(`/${locale}/games`);
  revalidatePath(`/${locale}/player`);
  revalidatePath(`/${locale}/league`);
  revalidatePath(`/${locale}/career`);
  return { ok: true };
}
