import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";

const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

export type AppUserRow = typeof appUsers.$inferSelect;

/** Routing: guest vs Firebase session without profile vs full member */
export type ViewerState =
  | { kind: "guest" }
  | { kind: "needs_onboarding"; firebaseUid: string }
  | { kind: "member"; user: AppUserRow };

export async function verifySessionCookie(): Promise<
  { uid: string; email?: string } | null
> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(token, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/** Lightweight session check for the digest poll (skips revocation lookup). */
export async function peekSessionCookie(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const auth = getAdminAuth();
    await auth.verifySessionCookie(token, false);
    return true;
  } catch {
    return false;
  }
}

export async function getViewer(): Promise<ViewerState> {
  const session = await verifySessionCookie();
  if (!session) return { kind: "guest" };

  const [row] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.firebaseUid, session.uid))
    .limit(1);

  if (!row) return { kind: "needs_onboarding", firebaseUid: session.uid };
  return { kind: "member", user: row };
}

/** Back-compat: member row only (null if guest or still onboarding). */
export async function getAppUser(): Promise<AppUserRow | null> {
  const v = await getViewer();
  if (v.kind === "member") return v.user;
  return null;
}

export { SESSION_COOKIE, SESSION_MAX_AGE_MS };
