"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { createGame } from "@/actions/games";

type Props = {
  /** Prefill from profile (`app_users.location`). */
  defaultLocation?: string;
};

export function CreateGameForm({ defaultLocation = "" }: Props) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const [expanded, setExpanded] = useState(false);
  const [dateStr, setDateStr] = useState("");

  return (
    <div className="flex flex-col gap-3">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 w-full rounded-xl bg-[var(--fp-moss)] px-6 font-semibold text-white transition hover:brightness-105"
        >
          {t("create")}
        </button>
      ) : (
        <form action={createGame} className="fp-enter flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--fp-ink)]">{t("create")}</h2>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setDateStr("");
              }}
              className="text-sm font-medium text-[var(--fp-brass-ink)] underline decoration-[var(--fp-brass-ink)]/70 underline-offset-4 hover:brightness-110"
            >
              {tCommon("cancel")}
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--fp-ink)]">
            <span>{t("scheduledStart")}</span>
            <input
              type="date"
              name="scheduled_date"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="fp-field min-h-11 w-full rounded-xl border border-[var(--fp-wood-mid)]/40 px-3 py-2 shadow-inner"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--fp-ink)]">
            <span>{t("gameNotes")}</span>
            <input
              type="text"
              name="notes"
              dir="auto"
              autoComplete="off"
              className="fp-field min-h-11 w-full rounded-xl border border-[var(--fp-wood-mid)]/40 px-3 py-2 shadow-inner"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--fp-ink)]">
            <span>{t("gameLocationField")}</span>
            <input
              type="text"
              name="location"
              dir="auto"
              autoComplete="street-address"
              placeholder=""
              defaultValue={defaultLocation}
              className="fp-field min-h-11 w-full rounded-xl border border-[var(--fp-wood-mid)]/40 px-3 py-2 shadow-inner"
            />
          </label>
          <button
            type="submit"
            disabled={!dateStr}
            className="min-h-11 rounded-xl bg-[var(--fp-moss)] px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("submitCreate")}
          </button>
        </form>
      )}
    </div>
  );
}
