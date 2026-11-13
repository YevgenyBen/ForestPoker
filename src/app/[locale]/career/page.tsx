import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCareerSummary } from "@/actions/games";
import { getViewer } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { CareerChart } from "@/components/CareerChart";
import { formatDateDdMmYyyy } from "@/lib/formatDate";
import { localizeGameTitle } from "@/lib/gameTitle";

export default async function CareerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);

  const t = await getTranslations("career");
  const tGames = await getTranslations("games");
  const { lifetimeNis, rows } = await getCareerSummary();

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);

  const df = (d: Date | null) =>
    d ? formatDateDdMmYyyy(d) : "—";

  const chartData = rows.reduce<
    { label: string; netNis: number; cumulative: number }[]
  >((acc, r, i) => {
    const prev = acc.length ? acc[acc.length - 1]!.cumulative : 0;
    const cumulative = prev + r.netNis;
    acc.push({
      label: r.closedAt ? df(r.closedAt) : `#${i + 1}`,
      netNis: r.netNis,
      cumulative,
    });
    return acc;
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fp-ink)]">{t("title")}</h1>
          <p className="text-sm text-[var(--fp-secondary)]">{t("subtitle")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <div
        className={`rounded-2xl border-2 px-4 py-6 text-center ${
          lifetimeNis >= 0
            ? "border-[var(--fp-win)] bg-[var(--fp-win)]/10"
            : "border-[var(--fp-loss)] bg-[var(--fp-loss)]/10"
        }`}
      >
        <p className="text-sm font-medium opacity-80">{t("lifetime")}</p>
        <p
          className={`mt-1 text-3xl font-bold tabular-nums ${
            lifetimeNis >= 0 ? "text-[var(--fp-win)]" : "text-[var(--fp-loss)]"
          }`}
          dir="ltr"
        >
          {money(lifetimeNis)}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-[var(--fp-parchment)]/60 px-4 py-8 text-center">
          {t("empty")}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.gameId}>
                <Link
                  href={`/${locale}/games/${r.gameId}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] px-4 py-3"
                >
                  <span className="font-medium" dir="auto">
                    {localizeGameTitle(r.title, (parts) => tGames("gameTitle", parts))}
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span
                      className={
                        r.netNis >= 0 ? "text-[var(--fp-win)]" : "text-[var(--fp-loss)]"
                      }
                      dir="ltr"
                    >
                      {money(r.netNis)}
                    </span>
                    <span className="text-xs text-[var(--fp-secondary)]">
                      {df(r.closedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <CareerChart data={chartData} />
        </>
      )}
    </main>
  );
}
