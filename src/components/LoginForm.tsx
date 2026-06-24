"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useLocale, useTranslations } from "next-intl";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { safeConsoleError } from "@/lib/logSafeError";
import { isIdeEmbeddedPreview } from "@/lib/auth/oauthEnvironment";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Spinner } from "@/components/Spinner";

const GOOGLE_OAUTH_FLAG = "fp_google_oauth_pending";

type PendingAction = "google" | "email" | "session" | null;

function authErrorToMessage(
  e: unknown,
  t: (key: string) => string
): string {
  const code =
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
      ? (e as { code: string }).code
      : undefined;
  switch (code) {
    case "auth/unauthorized-domain":
      return t("errors.unauthorizedDomain");
    case "auth/operation-not-allowed":
      return t("errors.providerDisabled");
    case "auth/email-already-in-use":
      return t("errors.emailInUse");
    case "auth/weak-password":
      return t("errors.weakPassword");
    case "auth/invalid-email":
      return t("errors.invalidEmail");
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return t("errors.invalidCredentials");
    case "auth/too-many-requests":
      return t("errors.tooManyRequests");
    case "auth/network-request-failed":
      return t("errors.network");
    case "auth/popup-blocked":
      return t("errors.popupBlocked");
    case "auth/cancelled-popup-request":
    case "auth/popup-closed-by-user":
      return t("errors.popupClosed");
    default:
      return t("errors.generic");
  }
}

function sessionEstablishErrorMessage(message: string, t: (key: string) => string): string {
  if (
    message === "session_failed" ||
    message.startsWith("session_") ||
    message.includes("session_http")
  ) {
    return t("errors.sessionCookie");
  }
  if (message === "no_token") {
    return t("errors.generic");
  }
  return `${t("errors.generic")} (${message})`;
}

function isFirebaseAuthError(e: unknown): e is { code: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    (e as { code: string }).code.startsWith("auth/")
  );
}

/** Firebase Auth failures vs. our session HTTP errors after sign-in. */
function signInFlowErrorMessage(e: unknown, t: (key: string) => string): string {
  if (isFirebaseAuthError(e)) {
    return authErrorToMessage(e, t);
  }
  if (e instanceof Error) {
    return sessionEstablishErrorMessage(e.message, t);
  }
  return t("errors.generic");
}

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [navigatingAway, setNavigatingAway] = useState(false);
  const [embeddedPreview, setEmbeddedPreview] = useState(false);
  const isBusy = pendingAction !== null || navigatingAway;
  const establishingRef = useRef(false);

  useEffect(() => {
    setEmbeddedPreview(isIdeEmbeddedPreview());
  }, []);

  const beginNavigation = useCallback(() => {
    flushSync(() => setNavigatingAway(true));
  }, []);

  const establishSession = useCallback(async () => {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error("no_token");
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    });
    const raw = await res.text();
    let payload: { error?: string; ok?: boolean } = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`session_http_${res.status}`);
    }
    if (!res.ok) {
      throw new Error(payload.error ?? `session_${res.status}`);
    }
    const me = (await fetch("/api/me", { credentials: "include" }).then((r) =>
      r.json()
    )) as {
      user: unknown;
      hasSession?: boolean;
    };
    if (me.user) {
      beginNavigation();
      router.push(`/${locale}/games`);
    } else if (me.hasSession) {
      beginNavigation();
      router.push(`/${locale}/onboarding`);
    } else {
      throw new Error("session_not_persisted");
    }
    router.refresh();
  }, [beginNavigation, locale, router]);

  /** After OAuth redirect or restored Firebase user: mint __session if missing. */
  const syncServerSessionIfNeeded = useCallback(async () => {
    if (establishingRef.current) return;
    const auth = getFirebaseAuth();
    try {
      await auth.authStateReady();
      if (!auth.currentUser) return;

      if (establishingRef.current) return;
      establishingRef.current = true;
      flushSync(() => setPendingAction("session"));

      const me = (await fetch("/api/me", { credentials: "include" }).then((r) =>
        r.json()
      )) as { user?: unknown; hasSession?: boolean };

      if (me.user || me.hasSession) {
        sessionStorage.removeItem(GOOGLE_OAUTH_FLAG);
        beginNavigation();
        if (me.user) {
          router.push(`/${locale}/games`);
        } else {
          router.push(`/${locale}/onboarding`);
        }
        router.refresh();
        return;
      }

      setError(null);
      await establishSession();
      sessionStorage.removeItem(GOOGLE_OAUTH_FLAG);
    } catch (e) {
      safeConsoleError("LoginForm:syncServerSessionIfNeeded", e);
      const msg = e instanceof Error ? e.message : "";
      setError(sessionEstablishErrorMessage(msg, t));
      setPendingAction(null);
    } finally {
      establishingRef.current = false;
    }
  }, [beginNavigation, establishSession, locale, router, t]);

  /**
   * Complete redirect OAuth, then sync server session. After `signInWithRedirect`, Firebase may apply
   * the credential shortly after `getRedirectResult` resolves — subscribe so we retry when `currentUser` appears.
   */
  useEffect(() => {
    const auth = getFirebaseAuth();
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;

    (async () => {
      try {
        await getRedirectResult(auth);
      } catch (e) {
        safeConsoleError("LoginForm:getRedirectResult", e);
      }
      if (cancelled) return;
      await syncServerSessionIfNeeded();
      if (cancelled) return;
      unsubAuth = onAuthStateChanged(auth, () => {
        if (!cancelled) void syncServerSessionIfNeeded();
      });
    })();

    return () => {
      cancelled = true;
      unsubAuth?.();
    };
  }, [syncServerSessionIfNeeded]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    flushSync(() => {
      setError(null);
      setPendingAction("email");
    });
    try {
      const auth = getFirebaseAuth();
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      await establishSession();
    } catch (e) {
      safeConsoleError("LoginForm:emailSubmit", e);
      setError(signInFlowErrorMessage(e, t));
      setPendingAction(null);
    }
  }

  async function handleGoogle() {
    if (embeddedPreview) return;
    flushSync(() => {
      setError(null);
      setPendingAction("google");
    });
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      /**
       * Prefer popup on HTTPS (including production): `establishSession` runs in this click turn,
       * so `POST /api/auth/session` always appears in Network. Redirect-only flow reloads the page
       * and depends on `getRedirectResult` + storage; if that handoff fails, no session request runs.
       */
      establishingRef.current = true;
      try {
        try {
          await signInWithPopup(auth, provider);
        } catch (e) {
          if (
            isFirebaseAuthError(e) &&
            e.code === "auth/popup-blocked"
          ) {
            sessionStorage.setItem(GOOGLE_OAUTH_FLAG, "1");
            await signInWithRedirect(auth, provider);
            return;
          }
          throw e;
        }
        await auth.authStateReady();
        await establishSession();
        sessionStorage.removeItem(GOOGLE_OAUTH_FLAG);
      } finally {
        establishingRef.current = false;
      }
    } catch (e) {
      safeConsoleError("LoginForm:googleSignIn", e);
      sessionStorage.removeItem(GOOGLE_OAUTH_FLAG);
      setError(signInFlowErrorMessage(e, t));
      setPendingAction(null);
    }
  }

  const googleLoading =
    navigatingAway || pendingAction === "google" || pendingAction === "session";
  const emailLoading =
    navigatingAway || pendingAction === "email" || pendingAction === "session";

  async function handleForgot() {
    if (!email) {
      setError(t("errors.generic"));
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      alert("Check your email for reset instructions.");
    } catch (e) {
      safeConsoleError("LoginForm:forgotPassword", e);
      setError(t("errors.generic"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 rounded-2xl border border-[var(--fp-wood-mid)]/30 bg-[var(--fp-panel)] p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[var(--fp-ink)]">{t("signIn")}</h1>
        <LocaleSwitcher />
      </div>

      {embeddedPreview && (
        <div
          className="rounded-xl border border-amber-700/40 bg-amber-950/35 px-3 py-3 text-sm text-amber-100"
          role="status"
        >
          <p className="font-semibold text-amber-50">{t("embeddedPreviewTitle")}</p>
          <p className="mt-1 text-xs leading-snug text-amber-100/90">
            {t("embeddedPreviewBody")}
          </p>
          <button
            type="button"
            onClick={() =>
              window.open(window.location.href, "_blank", "noopener,noreferrer")
            }
            className="mt-3 w-full rounded-lg bg-amber-600/90 px-3 py-2 text-center text-sm font-medium text-amber-950 hover:bg-amber-500"
          >
            {t("openExternalBrowser")}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isBusy || embeddedPreview}
        aria-busy={googleLoading}
        title={embeddedPreview ? t("embeddedPreviewBody") : undefined}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--fp-wood-mid)] bg-white px-4 font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {googleLoading && <Spinner className="size-4 shrink-0" />}
        {googleLoading ? tCommon("loading") : t("google")}
      </button>

      <div className="relative text-center text-xs text-[var(--fp-secondary)]">
        <span className="bg-[var(--fp-panel)] px-2">or email</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-[var(--fp-parchment)]" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4" aria-busy={isBusy}>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fp-ink)]">{t("email")}</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isBusy}
            className="fp-field w-full rounded-lg border border-[var(--fp-wood-mid)]/40 px-3 py-2"
            dir="ltr"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--fp-ink)]">{t("password")}</label>
          <input
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isBusy}
            className="fp-field w-full rounded-lg border border-[var(--fp-wood-mid)]/40 px-3 py-2"
            dir="ltr"
          />
        </div>
        {error && (
          <p
            className="rounded-lg border border-[var(--fp-loss)]/40 bg-[var(--fp-loss)]/12 px-3 py-2 text-sm font-medium text-[var(--fp-loss)]"
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isBusy}
          aria-busy={emailLoading}
          className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fp-moss)] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {emailLoading && <Spinner className="size-4 shrink-0 text-white" />}
          {emailLoading
            ? tCommon("loading")
            : mode === "register"
              ? t("signUp")
              : t("signIn")}
        </button>
      </form>

      <div className="flex flex-col gap-2 text-center text-sm">
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "register" : "signin")}
          disabled={isBusy}
          className="font-medium text-[var(--fp-brass)] underline decoration-[var(--fp-brass)]/70 underline-offset-[5px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mode === "signin" ? t("needAccount") : t("haveAccount")}
        </button>
        {mode === "signin" && (
          <button
            type="button"
            onClick={handleForgot}
            disabled={isBusy}
            className="font-medium text-[var(--fp-brass)] underline decoration-[var(--fp-brass)]/70 underline-offset-[5px] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("forgot")}
          </button>
        )}
      </div>
    </div>
  );
}
