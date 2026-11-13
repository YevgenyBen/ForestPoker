"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { logoutSession } from "@/lib/auth/clientLogout";

/** Last known session state, so a full page load doesn't flash a placeholder in the nav. */
const LOGGED_IN_CACHE_KEY = "fp:loggedIn";

function readCachedLoggedIn(): boolean | null {
  try {
    const v = sessionStorage.getItem(LOGGED_IN_CACHE_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

function writeCachedLoggedIn(v: boolean) {
  try {
    sessionStorage.setItem(LOGGED_IN_CACHE_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable: the nav just waits for /api/me */
  }
}

/** Shared box for every slot: equal width, 44px tall, one line of text. */
const NAV_SLOT =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-1 py-3 text-center text-sm font-medium";

function navButtonClass(active: boolean): string {
  return `${NAV_SLOT} cursor-pointer transition-[transform,filter,background-color,color,opacity] duration-200 ease-out motion-safe:hover:-translate-y-px motion-safe:hover:brightness-[1.06] motion-safe:active:translate-y-0 motion-safe:active:brightness-[0.96] ${
    active
      ? "bg-[var(--fp-moss)] text-white"
      : "text-[var(--fp-ink)] hover:bg-[var(--fp-parchment)]"
  }`;
}

function navAppLinkDisabledClass(): string {
  return `${NAV_SLOT} cursor-not-allowed text-[var(--fp-secondary)] opacity-40`;
}

function EasterEggDialog({
  quote,
  title,
  closeLabel,
  onClose,
}: {
  quote: string | null;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = quote !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="easter-egg-title"
      // Esc key
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-[var(--fp-wood-mid)]/40 bg-[var(--fp-panel)] p-0 text-center text-[var(--fp-ink)] shadow-xl fp-dialog"
    >
      <div className="flex flex-col items-center gap-3 p-4">
        <p id="easter-egg-title" className="w-full text-sm font-semibold text-[var(--fp-brass-ink)]">
          {title}
        </p>
        <p className="w-full text-sm leading-relaxed" dir="auto">
          {quote}
        </p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="min-h-11 w-full rounded-lg bg-[var(--fp-moss)] px-4 text-sm font-semibold text-white"
        >
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
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
    // Apply the cached state right after hydration (not during it, which would mismatch SSR).
    void Promise.resolve().then(() => {
      const cached = readCachedLoggedIn();
      if (!cancelled && cached !== null) setLoggedIn(cached);
    });
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: unknown; hasSession?: boolean }) => {
        if (!cancelled) {
          const v = Boolean(d?.hasSession || d?.user);
          setLoggedIn(v);
          writeCachedLoggedIn(v);
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
      writeCachedLoggedIn(false);
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
              <Link
                key={href}
                href={href}
                className={navButtonClass(active)}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}

          {loggedIn === null ? (
            // Holds the slot's size while the session check runs; nothing to read yet.
            <span className={NAV_SLOT} aria-hidden />
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
            <Link
              href={loginHref}
              className={navButtonClass(loginActive)}
              aria-current={loginActive ? "page" : undefined}
            >
              {t("login")}
            </Link>
          )}
        </div>
        {appVersion ? (
          <div className="flex justify-center border-t border-[var(--fp-wood-mid)]/40 px-3">
            <button
              type="button"
              onClick={openEasterEgg}
              className="min-h-6 rounded px-3 text-[11px] leading-none text-[var(--fp-secondary)] transition hover:bg-[var(--fp-parchment)]/60 hover:text-[var(--fp-ink)]"
              aria-label={tEgg("openLabel")}
              title={tEgg("openLabel")}
            >
              v{appVersion}
            </button>
          </div>
        ) : null}
      </nav>
      <EasterEggDialog
        quote={easterEgg !== null ? (quotes[easterEgg] ?? quotes[0] ?? "") : null}
        title={tEgg("title")}
        closeLabel={tCommon("close")}
        onClose={() => setEasterEgg(null)}
      />
    </>
  );
}
