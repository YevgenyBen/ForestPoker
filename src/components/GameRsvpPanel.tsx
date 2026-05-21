"use client";

import { useTranslations } from "next-intl";
import { setGameRsvp } from "@/actions/games";
import { useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";

type Rsvp = "yes" | "maybe" | "no";

export function GameRsvpPanel({
  gameId,
  myRsvp,
}: {
  gameId: string;
  myRsvp: Rsvp | null;
}) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const { pending, run } = useActionRefresh();

  async function pick(status: Rsvp) {
    await run(async () => {
      const r = await setGameRsvp(gameId, status);
      return "ok" in r;
    });
  }

  function btnClass(active: boolean) {
    return `min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
      active
        ? "bg-[var(--fp-moss)] text-white shadow-md"
        : "border border-[var(--fp-wood-mid)]/40 bg-[var(--fp-field-bg)] text-[var(--fp-ink)] hover:bg-[var(--fp-parchment)]"
    }`;
  }

  return (
    <section className="rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-panel)] p-4">
      <h2 className="mb-3 font-semibold text-[var(--fp-ink)]">{t("rsvpYourPick")}</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnClass(myRsvp === "yes")}
          disabled={pending}
          onClick={() => void pick("yes")}
        >
          {t("rsvpCall")}
        </button>
        <button
          type="button"
          className={btnClass(myRsvp === "maybe")}
          disabled={pending}
          onClick={() => void pick("maybe")}
        >
          {t("rsvpCheck")}
        </button>
        <button
          type="button"
          className={btnClass(myRsvp === "no")}
          disabled={pending}
          onClick={() => void pick("no")}
        >
          {t("rsvpFold")}
        </button>
      </div>
      {pending && (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--fp-secondary)]">
          <Spinner className="size-4 text-[var(--fp-moss)]" />
          {tCommon("loading")}
        </p>
      )}
    </section>
  );
}
