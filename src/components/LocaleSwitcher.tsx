"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const current = segments[0];
  const rest = segments.slice(1).join("/");
  const other =
    current === "en"
      ? "he"
      : current === "he"
        ? "en"
        : routing.defaultLocale;

  if (!routing.locales.includes(current as "en" | "he")) return null;

  const href = rest ? `/${other}/${rest}` : `/${other}`;

  return (
    <Link
      href={href}
      className="fp-tap text-sm font-medium text-[var(--fp-brass-ink)] underline decoration-[var(--fp-brass-ink)]/70 underline-offset-[5px] hover:text-[var(--fp-ink)] hover:decoration-[var(--fp-ink)]"
    >
      {other === "he" ? "עברית" : "English"}
    </Link>
  );
}
