"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { logoutSession } from "@/lib/auth/clientLogout";

function navButtonClass(active: boolean): string {
  return `flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg p-3 text-center text-sm font-medium transition-[transform,filter,background-color,color,opacity] duration-200 ease-out motion-safe:hover:-translate-y-px motion-safe:hover:brightness-[1.06] motion-safe:active:translate-y-0 motion-safe:active:brightness-[0.96] ${
    active
      ? "bg-[var(--fp-moss)] text-white"
      : "text-[var(--fp-ink)] hover:bg-[var(--fp-parchment)]"
  }`;
}

function navAppLinkDisabledClass(): string {
  return `flex min-h-11 min-w-0 flex-1 cursor-not-allowed items-center justify-center rounded-lg p-3 text-center text-sm font-medium text-[var(--fp-secondary)] opacity-40`;
}

export function BottomNav() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tEgg = useTranslations("easterEgg");
  const quotes = tEgg.raw("quotes") as string[];
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const base = `/${locale}`;
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  /** Index into `easterEgg.quotes`, so the quote follows a locale switch. */
  const [easterEgg, setEasterEgg] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: unknown; hasSession?: boolean }) => {
        if (!cancelled) {
          setLoggedIn(Boolean(d?.hasSession || d?.user));
        }
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutSession();
      setLoggedIn(false);
      router.push(`${base}/login`);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function openEasterEgg() {
    setEasterEgg(Math.floor(Math.random() * quotes.length));
  }

  const loginHref = `${base}/login`;
  const loginActive =
    pathname === loginHref || pathname.startsWith(`${loginHref}/`);

  const items = [
    { href: `${base}/games`, label: t("games") },
    { href: `${base}/league`, label: t("league") },
    { href: `${base}/career`, label: t("career") },
    { href: `${base}/player`, label: t("profile") },
  ];

  const appNavLocked = loggedIn === false;

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--fp-wood-mid)] bg-[var(--fp-panel)]/95 backdrop-blur-sm safe-area-pb">
      <div className="mx-auto flex max-w-lg gap-1 px-3 py-2">
        {items.map(({ href, label }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          if (appNavLocked) {
            return (
              <span
                key={href}
                className={navAppLinkDisabledClass()}
                aria-disabled="true"
                title={t("signInToNavigate")}
              >
                {label}
              </span>
            );
          }
          return (
            <Link key={href} href={href} className={navButtonClass(active)}>
              {label}
            </Link>
          );
        })}

        {loggedIn === null ? (
          <span
            className={`${navButtonClass(false)} opacity-50`}
            aria-hidden
          >
            …
          </span>
        ) : loggedIn ? (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={navButtonClass(false)}
          >
            {loggingOut ? tCommon("loading") : t("logout")}
          </button>
        ) : (
          <Link href={loginHref} className={navButtonClass(loginActive)}>
            {t("login")}
          </Link>
        )}
      </div>
      {appVersion ? (
        <div className="flex justify-center border-t border-[var(--fp-wood-mid)]/40 px-3 py-1 text-[10px] leading-tight text-[var(--fp-ink)]/45">
          <button
            type="button"
            onClick={openEasterEgg}
            className="rounded px-1 transition hover:bg-[var(--fp-parchment)]/60 hover:text-[var(--fp-ink)]"
            aria-label={tEgg("openLabel")}
            title={tEgg("openLabel")}
          >
            v{appVersion}
          </button>
        </div>
      ) : null}
    </nav>
    {easterEgg !== null
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center bg-black/60 px-4"
            onClick={() => setEasterEgg(null)}
            role="dialog"
            aria-modal="true"
            aria-label={tEgg("title")}
          >
            <div
              className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-[var(--fp-wood-mid)]/40 bg-[var(--fp-panel)] p-4 text-center shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="w-full text-sm font-semibold text-[var(--fp-brass)]">
                {tEgg("title")}
              </p>
              <p className="w-full text-sm leading-relaxed text-[var(--fp-ink)]" dir="auto">
                {quotes[easterEgg] ?? quotes[0]}
              </p>
              <button
                type="button"
                onClick={() => setEasterEgg(null)}
                className="min-h-10 w-full max-w-full rounded-lg bg-[var(--fp-moss)] px-4 text-sm font-semibold text-white"
              >
                {tCommon("close")}
              </button>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  );
}
