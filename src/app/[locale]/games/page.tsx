import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  listGamesBySection,
  type ListedGameRow,
} from "@/actions/games";
import { getViewer } from "@/lib/auth/session";
import { canDeleteGames } from "@/lib/auth/gameAdmin";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { CancelScheduledGameButton } from "@/components/CancelScheduledGameButton";
import { DeleteGameButton } from "@/components/DeleteGameButton";
import { CreateGameForm } from "@/components/CreateGameForm";
import { DbSync } from "@/components/DbSync";
import { LocationWazeLink } from "@/components/LocationWazeLink";
import {
  formatDateDdMmYyyy,
  formatDateTimeDdMmYyyyHm,
} from "@/lib/formatDate";

function GameRow({
  g,
  locale,
  showCancelScheduled,
  showGameDelete,
  t,
}: {
  g: ListedGameRow;
  locale: string;
  showCancelScheduled: boolean;
  showGameDelete: boolean;
  t: (key: string) => string;
}) {
  const rowClass =
    g.status === "scheduled"
      ? "flex items-stretch gap-2 rounded-xl border-2 border-[var(--fp-brass)] bg-[var(--fp-panel)] transition hover:bg-[var(--fp-brass)]/8"
      : g.status === "open"
        ? "flex items-stretch gap-2 rounded-xl border-2 border-[var(--fp-win)] bg-[var(--fp-panel)] transition hover:bg-[var(--fp-win)]/8"
        : "flex items-stretch gap-2 rounded-xl border-2 border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] transition hover:bg-[var(--fp-parchment)]";

  const statusText =
    g.status === "scheduled"
      ? t("statusScheduled")
      : g.status === "open"
        ? t("statusOpen")
        : t("statusClosed");

  const statusClass =
    g.status === "scheduled"
      ? "text-[var(--fp-brass)]"
      : g.status === "open"
        ? "text-[var(--fp-win)]"
        : "text-[var(--fp-secondary)]";

  return (
    <li>
      <div className={rowClass}>
        <Link
          href={`/${locale}/games/${g.id}`}
          className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span
              className="min-w-0 flex-1 font-medium text-[var(--fp-ink)]"
              dir="auto"
            >
              {g.title}
            </span>
            {g.status !== "scheduled" && (
              <span className="flex shrink-0 items-center gap-2 text-sm">
                <span className={statusClass}>{statusText}</span>
                <span className="text-[var(--fp-secondary)]">
                  {formatDateTimeDdMmYyyyHm(g.createdAt)}
                </span>
              </span>
            )}
            {g.status === "scheduled" && (
              <span className={`shrink-0 text-sm font-medium ${statusClass}`}>{statusText}</span>
            )}
          </div>
          {g.status === "scheduled" && (
            <div className="space-y-1.5 text-sm text-[var(--fp-secondary)]">
              <p dir="auto">
                <span className="font-medium text-[var(--fp-ink)]">{t("hostLabel")}: </span>
                {g.initiatorUsername}
              </p>
              {g.scheduledStartAt && (
                <p dir="auto">
                  <span className="font-medium text-[var(--fp-ink)]">{t("whenLabel")}: </span>
                  {formatDateDdMmYyyy(g.scheduledStartAt)}
                </p>
              )}
              {g.notes?.trim() ? (
                <p className="line-clamp-4 text-[var(--fp-ink)]" dir="auto">
                  {g.notes}
                </p>
              ) : null}
              <p dir="auto">
                <span className="font-medium text-[var(--fp-ink)]">{t("locationShort")}: </span>
                <LocationWazeLink
                  address={
                    g.gameLocation?.trim() || g.initiatorLocation?.trim() || ""
                  }
                  openInWazeLabel={t("openInWaze")}
                />
              </p>
            </div>
          )}
        </Link>
        {(showCancelScheduled || showGameDelete) && (
          <div className="flex shrink-0 items-center border-s border-[var(--fp-wood-mid)]/20 px-2 py-2">
            {showCancelScheduled ? (
              <CancelScheduledGameButton gameId={g.id} compact />
            ) : (
              <DeleteGameButton gameId={g.id} compact />
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--fp-secondary)]">
        {title}
      </h3>
      {children ? (
        children
      ) : (
        <p className="rounded-xl bg-[var(--fp-parchment)]/50 px-4 py-6 text-center text-sm text-[var(--fp-secondary)]">
          {empty}
        </p>
      )}
    </div>
  );
}

export default async function GamesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);
  const user = v.user;

  const { upcoming, current, past } = await listGamesBySection();
  const t = await getTranslations("games");
  const isGameAdmin = canDeleteGames(user.email);
  const canCancelScheduledRow = (g: ListedGameRow) =>
    g.status === "scheduled" &&
    (g.createdBy === user.id || isGameAdmin);
  const showGameDeleteRow = (g: ListedGameRow) =>
    isGameAdmin && g.status !== "scheduled";

  const totalCount = upcoming.length + current.length + past.length;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <DbSync mode="global" />
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fp-ink)]">{t("title")}</h1>
          <p className="text-sm text-[var(--fp-secondary)]" dir="auto">
            {user.username}
          </p>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="rounded-2xl border border-[var(--fp-wood-mid)]/30 bg-[var(--fp-panel)] p-4 shadow-sm">
        <CreateGameForm defaultLocation={user.location ?? ""} />
      </section>

      <section className="space-y-8">
        {totalCount === 0 ? (
          <p className="rounded-xl bg-[var(--fp-parchment)]/60 px-4 py-8 text-center text-[var(--fp-secondary)]">
            {t("empty")}
          </p>
        ) : (
          <>
            <Section title={t("sectionUpcoming")} empty={t("emptyUpcoming")}>
              {upcoming.length > 0 ? (
                <ul className="space-y-2">
                  {upcoming.map((g) => (
                    <GameRow
                      key={g.id}
                      g={g}
                      locale={locale}
                      showCancelScheduled={canCancelScheduledRow(g)}
                      showGameDelete={showGameDeleteRow(g)}
                      t={t}
                    />
                  ))}
                </ul>
              ) : null}
            </Section>

            <Section title={t("sectionCurrent")} empty={t("emptyCurrent")}>
              {current.length > 0 ? (
                <ul className="space-y-2">
                  {current.map((g) => (
                    <GameRow
                      key={g.id}
                      g={g}
                      locale={locale}
                      showCancelScheduled={canCancelScheduledRow(g)}
                      showGameDelete={showGameDeleteRow(g)}
                      t={t}
                    />
                  ))}
                </ul>
              ) : null}
            </Section>

            <Section title={t("sectionPast")} empty={t("emptyPast")}>
              {past.length > 0 ? (
                <ul className="space-y-2">
                  {past.map((g) => (
                    <GameRow
                      key={g.id}
                      g={g}
                      locale={locale}
                      showCancelScheduled={canCancelScheduledRow(g)}
                      showGameDelete={showGameDeleteRow(g)}
                      t={t}
                    />
                  ))}
                </ul>
              ) : null}
            </Section>
          </>
        )}
      </section>
    </main>
  );
}
