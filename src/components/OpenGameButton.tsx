"use client";

import { useTranslations } from "next-intl";
import { openGame } from "@/actions/games";
import { useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";

export function OpenGameButton({ gameId }: { gameId: string }) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const { pending, run } = useActionRefresh();

  async function handle() {
    await run(async () => {
      const r = await openGame(gameId);
      return "ok" in r;
    });
  }

  return (
    <button
      type="button"
      onClick={() => void handle()}
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fp-moss)] px-4 py-2 font-semibold text-white disabled:opacity-50"
    >
      {pending && <Spinner className="size-4 text-white" />}
      {pending ? tCommon("loading") : t("openTable")}
    </button>
  );
}
