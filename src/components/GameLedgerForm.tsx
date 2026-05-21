"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { addLedgerEntry } from "@/actions/games";
import { useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";

type Props = {
  gameId: string;
};

const svgProps = {
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Racetrack rail + felt — top-down poker table */
function PokerTableShape() {
  return (
    <>
      <rect x="2" y="10.5" width="16" height="8" rx="4" />
      <rect x="4.25" y="12" width="11.5" height="5" rx="2.5" />
      <path d="M8.25 12h3.5" strokeWidth="1.25" />
    </>
  );
}

/** Arrow above — enter the table */
function BuyInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <PokerTableShape />
      <path d="M10 2.75v5" />
      <path d="M8 6l2 2 2-2" />
    </svg>
  );
}

/** Arrow above — leave the table */
function BuyOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgProps}>
      <PokerTableShape />
      <path d="M10 9V3.75" />
      <path d="M8 5.75l2-2 2 2" />
    </svg>
  );
}

export function GameLedgerForm({ gameId }: Props) {
  const t = useTranslations("games");
  const tCommon = useTranslations("common");
  const { pending, run } = useActionRefresh();
  const [kind, setKind] = useState<"buy_in" | "buy_out">("buy_in");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isBuyIn = kind === "buy_in";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n < 1) {
      setError("invalid");
      return;
    }
    await run(async () => {
      const res = await addLedgerEntry({
        gameId,
        kind,
        amountNis: n,
      });
      if (res.error) {
        setError(res.error);
        return false;
      }
      setAmount("");
      return true;
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[var(--fp-wood-mid)]/25 bg-[var(--fp-parchment)]/40 p-4"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("buy_in")}
          disabled={pending}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
            isBuyIn
              ? "bg-[var(--fp-loss)] text-white shadow-sm"
              : "border border-[var(--fp-loss)]/30 bg-[var(--fp-loss)]/8 text-[var(--fp-loss)]"
          }`}
        >
          <BuyInIcon className="size-5 shrink-0" />
          {t("buyIn")}
        </button>
        <button
          type="button"
          onClick={() => setKind("buy_out")}
          disabled={pending}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
            !isBuyIn
              ? "bg-[var(--fp-win)] text-white shadow-sm"
              : "border border-[var(--fp-win)]/35 bg-[var(--fp-win)]/10 text-[var(--fp-win)]"
          }`}
        >
          <BuyOutIcon className="size-5 shrink-0" />
          {t("buyOut")}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--fp-ink)]">
          {t("amountNis")}
        </label>
        <input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={pending}
          className="fp-field w-full rounded-lg border border-[var(--fp-wood-mid)]/40 px-3 py-2"
          dir="ltr"
        />
      </div>
      {error && (
        <p className="rounded-lg border border-[var(--fp-loss)]/40 bg-[var(--fp-loss)]/12 px-3 py-2 text-sm font-medium text-[var(--fp-loss)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`flex w-full min-h-11 items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-sm disabled:opacity-50 ${
          isBuyIn ? "bg-[var(--fp-loss)]" : "bg-[var(--fp-win)]"
        }`}
      >
        {pending && <Spinner className="size-4 text-white" />}
        {pending ? tCommon("loading") : t("addEntry")}
      </button>
    </form>
  );
}
