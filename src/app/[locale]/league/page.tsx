import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatNis } from "@/lib/formatMoney";
import { getLeagueStandings } from "@/actions/games";
import { getViewer } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ltrAlignText } from "@/lib/ltrText";
import type { LeagueStandingRow } from "@/lib/leagueStandings";

const NOTICE_CLASS =
  "rounded-xl bg-[var(--fp-parchment)]/60 px-4 py-8 text-center text-[var(--fp-secondary)]";

function StandingsTable({
  rows,
  ranked,
  viewerId,
  money,
  labels,
  gamesPlayedLabel,
}: {
  rows: LeagueStandingRow[];
  ranked: boolean;
  viewerId: string | null;
  money: (n: number) => string;
  labels: { rank: string; player: string; total: string };
  gamesPlayedLabel: (played: number) => string;
}) {
  return (
    <div
      className="overflow-x-auto rounded-2xl border border-[var(--fp-wood-mid)]/30 bg-[var(--fp-panel)] shadow-sm"
      dir="ltr"
    >
      <table className="w-full min-w-[280px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--fp-wood-mid)]/25 bg-[var(--fp-parchment)]/40">
            {ranked && (
              <th className="w-12 px-4 py-3 text-left font-semibold text-[var(--fp-ink)]">
                {labels.rank}
              </th>
            )}
            <th className="w-full px-4 py-3 text-left font-semibold text-[var(--fp-ink)]">
              {labels.player}
            </th>
            <th className="w-24 px-4 py-3 text-end font-semibold text-[var(--fp-ink)]">
              {labels.total}
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
                {ranked && (
                  <td className="px-4 py-3 text-left tabular-nums text-[var(--fp-secondary)]">
                    {i + 1}
                  </td>
                )}
                <td className="px-4 py-3 text-left font-medium text-[var(--fp-ink)]" dir="ltr">
                  <span
                    dir="ltr"
                    className="block w-full truncate text-left [unicode-bidi:isolate]"
                  >
                    {ltrAlignText(r.username)}
                  </span>
                  <span
                    dir="auto"
                    className="block w-full text-left text-xs font-normal text-[var(--fp-secondary)]"
                  >
                    {gamesPlayedLabel(r.gamesPlayed)}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 text-end tabular-nums ${
                    positive ? "text-[var(--fp-win-ink)]" : "text-[var(--fp-loss-ink)]"
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
  );
}

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
  const { active, inactive, closedGameCount, activityThresholdPct } =
    await getLeagueStandings();

  const money = (n: number) => formatNis(locale, n);

  const tableProps = {
    viewerId,
    money,
    labels: { rank: t("rank"), player: t("player"), total: t("total") },
    gamesPlayedLabel: (played: number) =>
      t("gamesPlayed", { played, total: closedGameCount }),
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fp-ink)]">{t("title")}</h1>
          <p className="text-sm text-[var(--fp-secondary)]">
            {activityThresholdPct === 50
              ? t("subtitle")
              : t("subtitleThreshold", { pct: activityThresholdPct })}
          </p>
        </div>
        <LocaleSwitcher />
      </header>

      {active.length === 0 && inactive.length === 0 ? (
        <p className={NOTICE_CLASS}>
          {t("empty")}
        </p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className={NOTICE_CLASS}>
              {t("allInactive")}
            </p>
          ) : (
            <StandingsTable rows={active} ranked {...tableProps} />
          )}

          {inactive.length > 0 && (
            <details className="fp-disclosure">
              <summary className="cursor-pointer select-none py-3 text-sm font-semibold text-[var(--fp-secondary)] hover:text-[var(--fp-ink)]">
                {t("inactiveTitle", { count: inactive.length })}
              </summary>
              <div className="mt-3">
                <StandingsTable rows={inactive} ranked={false} {...tableProps} />
              </div>
            </details>
          )}
        </>
      )}

      <p className="text-center text-sm text-[var(--fp-secondary)]">
        <Link
          href={`/${locale}/career`}
          className="fp-tap font-medium text-[var(--fp-brass-ink)] underline decoration-[var(--fp-brass-ink)]/70 underline-offset-[5px] hover:brightness-110"
        >
          {t("careerLink")}
        </Link>
      </p>
    </main>
  );
}
