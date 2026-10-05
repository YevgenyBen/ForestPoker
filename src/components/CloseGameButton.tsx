"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { closeGame } from "@/actions/games";
import { useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Props = {
  gameId: string;
  disabled?: boolean;
};

export function CloseGameButton({ gameId, disabled }: Props) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const { pending, run } = useActionRefresh();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleClose() {
    setConfirming(false);
    setError(null);
    await run(async () => {
      const res = await closeGame(gameId);
      if (res.error === "bad_balance") {
        setError(t("balanceError"));
        return false;
      }
      if (res.error === "already_closed") {
        setError(t("alreadyClosed"));
        return false;
      }
      if (res.error) {
        setError(res.error);
        return false;
      }
      return true;
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || pending}
        className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[var(--fp-loss)] bg-transparent font-semibold text-[var(--fp-loss)] disabled:opacity-50"
      >
        {pending && <Spinner className="size-4" />}
        {pending ? tCommon("loading") : t("closeGame")}
      </button>
      {error && <p className="text-sm text-[var(--fp-loss)]">{error}</p>}
      <ConfirmDialog
        open={confirming}
        message={t("closeConfirm")}
        confirmLabel={t("closeGame")}
        cancelLabel={t("closeKeepPlaying")}
        onConfirm={() => void handleClose()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
