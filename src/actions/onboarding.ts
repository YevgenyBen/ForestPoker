"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { verifySessionCookie } from "@/lib/auth/session";
import { getAdminAuth } from "@/lib/firebase/admin";
import { safeConsoleError } from "@/lib/logSafeError";
import { usernameSchema } from "@/lib/username";
import { bumpSyncVersion } from "@/lib/sync/bump";

export type OnboardingActionState =
  | { error: "invalid" | "taken" | "no_email" | "failed" }
  | null;

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const locale = await getLocale();
  const raw = formData.get("username");
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "invalid" };
  }
  const username = parsed.data;

  const session = await verifySessionCookie();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  let email: string;
  try {
    const fbUser = await getAdminAuth().getUser(session.uid);
    email = fbUser.email ?? "";
  } catch (e) {
    safeConsoleError("onboarding:getUser", e);
    return { error: "failed" };
  }

  if (!email) {
    return { error: "no_email" };
  }

  const [already] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.firebaseUid, session.uid))
    .limit(1);
  if (already) {
    redirect(`/${locale}/games`);
  }

  const exists = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(sql`lower(${appUsers.username}) = lower(${username})`)
    .limit(1);

  if (exists.length) {
    return { error: "taken" };
  }

  try {
    await db.insert(appUsers).values({
      firebaseUid: session.uid,
      email,
      username,
    });
    await bumpSyncVersion(db);
  } catch (e) {
    safeConsoleError("onboarding:insertAppUser", e);
    return { error: "failed" };
  }

  redirect(`/${locale}/games`);
}
