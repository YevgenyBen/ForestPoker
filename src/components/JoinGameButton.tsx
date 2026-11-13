"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { joinGame } from "@/actions/games";
import { useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";

type Props = {
  gameId: string;
};

export function JoinGameButton({ gameId }: Props) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const { pending, run } = useActionRefresh();
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setError(null);
    await run(async () => {
      const res = await joinGame(gameId);
      // Refresh either way so a closed game shows its current state.
      if ("error" in res) setError(t("alreadyClosed"));
      return true;
    });
  }

  return (
    <div className="flex flex-col gap-2">
    <button
      type="button"
      onClick={() => void handleJoin()}
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fp-moss)] px-4 py-2 font-semibold text-white disabled:opacity-50"
    >
      {pending && <Spinner className="size-4 text-white" />}
      {pending ? tCommon("loading") : t("join")}
    </button>
    {error && <p className="text-sm text-[var(--fp-loss-ink)]" role="alert">{error}</p>}
    </div>
  );
}
