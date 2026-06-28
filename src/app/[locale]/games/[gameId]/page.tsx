import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGameDetail } from "@/actions/games";
import { getViewer } from "@/lib/auth/session";
import { canDeleteGames } from "@/lib/auth/gameAdmin";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { JoinGameButton } from "@/components/JoinGameButton";
import { GameLedgerForm } from "@/components/GameLedgerForm";
import { CloseGameButton } from "@/components/CloseGameButton";
import { CancelScheduledGameButton } from "@/components/CancelScheduledGameButton";
import { DeleteGameButton } from "@/components/DeleteGameButton";
import { OpenGameButton } from "@/components/OpenGameButton";
import { LocationWazeLink } from "@/components/LocationWazeLink";
import { GameRsvpPanel } from "@/components/GameRsvpPanel";
import { ActionRefreshBoundary } from "@/components/ActionRefreshBoundary";
import { DbSync } from "@/components/DbSync";
import {
  formatDateDdMmYyyy,
  formatDateTimeDdMmYyyyHm,
} from "@/lib/formatDate";

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale, gameId } = await params;
  const v = await getViewer();
  if (v.kind === "guest") redirect(`/${locale}/login`);
  if (v.kind === "needs_onboarding") redirect(`/${locale}/onboarding`);

  const detail = await getGameDetail(gameId);
  if (!detail) notFound();

  const {
    game,
    members,
    bankNis,
    settlements,
    closerName,
    isMember,
    initiatorUsername,
    initiatorLocation,
    rsvp,
    myRsvp,
  } = detail;
  const isScheduled = game.status === "scheduled";
  const canDeleteGame =
    v.kind === "member" && canDeleteGames(v.user.email);
  const isHost = v.kind === "member" && game.createdBy === v.user.id;
  const canCancelScheduled =
    v.kind === "member" &&
    isScheduled &&
    (isHost || canDeleteGames(v.user.email));
  const t = await getTranslations("games");

  const money = (n: number) =>
    new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <main className="flex flex-1 flex-col gap-6 pb-4">
      <DbSync mode="game" gameId={gameId} gameStatus={game.status} />
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/${locale}/games`}
            className="text-sm font-medium text-[var(--fp-brass)] underline decoration-[var(--fp-brass)]/70 underline-offset-[5px] hover:brightness-110"
          >
            ← {t("title")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--fp-ink)]" dir="auto">
            {game.title}
          </h1>
          <p className="text-sm text-[var(--fp-secondary)]">
            {game.status === "scheduled"
              ? t("statusScheduled")
              : game.status === "open"
                ? t("statusOpen")
                : t("statusClosed")}
            {game.status === "scheduled" && game.scheduledStartAt
              ? ` · ${formatDateDdMmYyyy(game.scheduledStartAt)}`
              : game.status !== "scheduled"
                ? ` · ${formatDateTimeDdMmYyyyHm(game.createdAt)}`
                : ""}
          </p>
        </div>
        <LocaleSwitcher />
      </header>

      <ActionRefreshBoundary>
      {isScheduled && (
        <section className="space-y-2 rounded-xl border border-[var(--fp-brass)]/35 bg-[var(--fp-brass)]/8 p-4 text-sm">
          <p dir="auto">
            <span className="font-semibold text-[var(--fp-ink)]">{t("hostLabel")}: </span>
            {initiatorUsername}
          </p>
          {game.notes?.trim() ? (
            <p className="text-[var(--fp-ink)]" dir="auto">
              {game.notes}
            </p>
          ) : null}
          <p dir="auto">
            <span className="font-semibold text-[var(--fp-ink)]">{t("locationShort")}: </span>
            <LocationWazeLink
              address={game.location?.trim() || initiatorLocation?.trim() || ""}
              openInWazeLabel={t("openInWaze")}
            />
          </p>
        </section>
      )}

      {isScheduled && rsvp && (
        <>
          <GameRsvpPanel gameId={gameId} myRsvp={myRsvp} />

          {(isHost || canCancelScheduled) && (
            <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] p-4">
              {isHost && (
                <div className="flex flex-wrap items-center gap-3">
                  <OpenGameButton gameId={gameId} />
                </div>
              )}
              {canCancelScheduled && (
                <div className={isHost ? "ms-auto shrink-0" : "shrink-0"}>
                  <CancelScheduledGameButton gameId={gameId} />
                </div>
              )}
            </section>
          )}

          <section className="space-y-4">
            <h2 className="font-semibold text-[var(--fp-ink)]">{t("rsvpPlayersHeading")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--fp-win)]/35 bg-[var(--fp-win)]/6 p-3">
                <h3 className="mb-2 text-sm font-semibold text-[var(--fp-win)]">
                  {t("rsvpComingList")}
                </h3>
                {rsvp.yes.length === 0 ? (
                  <p className="text-sm text-[var(--fp-secondary)]">{t("rsvpEmptyColumn")}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {rsvp.yes.map((p) => (
                      <li key={p.userId} dir="ltr">
                        <span dir="auto">{p.username}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-[var(--fp-brass)]/35 bg-[var(--fp-brass)]/8 p-3">
                <h3 className="mb-2 text-sm font-semibold text-[var(--fp-brass)]">
                  {t("rsvpMaybeList")}
                </h3>
                {rsvp.maybe.length === 0 ? (
                  <p className="text-sm text-[var(--fp-secondary)]">{t("rsvpEmptyColumn")}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {rsvp.maybe.map((p) => (
                      <li key={p.userId} dir="ltr">
                        <span dir="auto">{p.username}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-[var(--fp-wood-mid)]/35 bg-[var(--fp-parchment)]/40 p-3">
                <h3 className="mb-2 text-sm font-semibold text-[var(--fp-secondary)]">
                  {t("rsvpNotList")}
                </h3>
                {rsvp.no.length === 0 ? (
                  <p className="text-sm text-[var(--fp-secondary)]">{t("rsvpEmptyColumn")}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {rsvp.no.map((p) => (
                      <li key={p.userId} dir="ltr">
                        <span dir="auto">{p.username}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {!isScheduled && (
        <>
          {game.status === "open" && isMember && (
            <GameLedgerForm gameId={gameId} />
          )}

          {game.status === "open" && !isMember && (
            <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] p-4">
              <JoinGameButton gameId={gameId} />
              <p className="text-sm text-[var(--fp-secondary)]">
                {t("nonMemberHint")}
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold text-[var(--fp-ink)]">{t("members")}</h2>
            <div className="rounded-xl bg-[var(--fp-parchment)]/50 p-3" dir="ltr">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold text-[var(--fp-secondary)]">
                    <th className="pb-2 text-left font-semibold">
                      {t("playerNames")}
                    </th>
                    <th className="w-[5.5rem] pb-2 text-end font-semibold">
                      {t("buyIn")}
                    </th>
                    <th className="w-[5.5rem] pb-2 text-end font-semibold">
                      {t("ledgerBuyOut")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId}>
                      <td className="max-w-0 py-0.5 text-left" dir="ltr">
                        <span className="block truncate">{m.username}</span>
                      </td>
                      <td
                        className="py-0.5 text-end tabular-nums font-semibold text-[var(--fp-ink)]"
                        dir="ltr"
                      >
                        {money(m.buyInTotalNis)}
                      </td>
                      <td
                        className="py-0.5 text-end tabular-nums font-semibold text-[var(--fp-ink)]"
                        dir="ltr"
                      >
                        {money(m.buyOutTotalNis)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {game.status === "open" && (
            <section
              className="rounded-xl border border-[var(--fp-brass)]/35 bg-[var(--fp-parchment)]/45 px-4 py-3 shadow-sm"
              aria-label={t("bankAria")}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--fp-ink)]">
                  {t("bank")}
                </span>
                <span
                  className={`text-lg font-bold tabular-nums ${
                    bankNis >= 0 ? "text-[var(--fp-moss)]" : "text-[var(--fp-loss)]"
                  }`}
                  dir="ltr"
                >
                  {money(bankNis)}
                </span>
              </div>
            </section>
          )}

          {game.status === "open" && isMember && (
            <CloseGameButton gameId={gameId} />
          )}

          {game.status === "closed" && (
            <section>
              <h2 className="mb-2 font-semibold text-[var(--fp-ink)]">{t("settlements")}</h2>
              {settlements.length === 0 ? (
                <p className="text-sm text-[var(--fp-secondary)]">—</p>
              ) : (
                <ul className="space-y-2">
                  {settlements.map((s, i) => (
                    <li
                      key={`${s.fromUserId}-${s.toUserId}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--fp-parchment)]/60 px-3 py-2 text-sm"
                    >
                      <span className="inline-flex items-center gap-1.5" dir="ltr">
                        <strong dir="auto">{s.fromName}</strong>
                        <span aria-hidden="true">→</span>
                        <strong dir="auto">{s.toName}</strong>
                      </span>
                      <span className="tabular-nums font-semibold" dir="ltr">
                        {money(s.amountNis)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {closerName && (
                <p className="mt-2 text-sm text-[var(--fp-secondary)]">
                  {t("closedBy")}: <span dir="auto">{closerName}</span>
                </p>
              )}
            </section>
          )}
        </>
      )}

      {canDeleteGame && !isScheduled && (
        <section className="rounded-xl border border-[var(--fp-loss)]/35 bg-[var(--fp-loss)]/5 p-4">
          <p className="mb-3 text-sm leading-snug text-[var(--fp-loss)]">
            {t("deleteGameWarning")}
          </p>
          <DeleteGameButton gameId={gameId} />
        </section>
      )}
      </ActionRefreshBoundary>
    </main>
  );
}
