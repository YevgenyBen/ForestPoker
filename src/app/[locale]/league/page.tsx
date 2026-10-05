import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLeagueStandings } from "@/actions/games";
import { getViewer } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ltrAlignText } from "@/lib/ltrText";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);

  const viewerId = v.kind === "member" ? v.user.id : null;

  const t = await getTranslations("league");
  const { rows } = await getLeagueStandings();

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fp-ink)]">{t("title")}</h1>
          <p className="text-sm text-[var(--fp-secondary)]">{t("subtitle")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-[var(--fp-parchment)]/60 px-4 py-8 text-center text-[var(--fp-secondary)]">
          {t("empty")}
        </p>
      ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-[var(--fp-wood-mid)]/30 bg-[var(--fp-panel)] shadow-sm"
          dir="ltr"
        >
          <table className="w-full min-w-[280px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--fp-wood-mid)]/25 bg-[var(--fp-parchment)]/40">
                <th className="w-12 px-4 py-3 text-left font-semibold text-[var(--fp-ink)]">
                  {t("rank")}
                </th>
                <th className="w-full px-4 py-3 text-left font-semibold text-[var(--fp-ink)]">
                  {t("player")}
                </th>
                <th className="w-24 px-4 py-3 text-end font-semibold text-[var(--fp-ink)]">
                  {t("total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isSelf = viewerId !== null && r.userId === viewerId;
                const positive = r.lifetimeNetNis >= 0;
                return (
                  <tr
                    key={r.userId}
                    className={`border-b border-[var(--fp-wood-mid)]/15 last:border-b-0 ${
                      isSelf ? "bg-[var(--fp-moss)]/12" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-left tabular-nums text-[var(--fp-secondary)]">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3 text-left font-medium text-[var(--fp-ink)]" dir="ltr">
                      <span
                        dir="ltr"
                        className="block w-full truncate text-left [unicode-bidi:isolate]"
                      >
                        {ltrAlignText(r.username)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-end tabular-nums ${
                        positive ? "text-[var(--fp-win)]" : "text-[var(--fp-loss)]"
                      }`}
                      dir="ltr"
                    >
                      {money(r.lifetimeNetNis)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-sm text-[var(--fp-secondary)]">
        <Link
          href={`/${locale}/career`}
          className="font-medium text-[var(--fp-brass)] underline decoration-[var(--fp-brass)]/70 underline-offset-[5px] hover:brightness-110"
        >
          {t("careerLink")}
        </Link>
      </p>
    </main>
  );
}
