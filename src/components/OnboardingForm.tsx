"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  completeOnboarding,
  type OnboardingActionState,
} from "@/actions/onboarding";

function errorMessage(
  state: OnboardingActionState,
  tOnboarding: (key: string) => string
): string | null {
  if (!state?.error) return null;
  switch (state.error) {
    case "invalid":
      return tOnboarding("invalid");
    case "taken":
      return tOnboarding("taken");
    case "no_email":
      return tOnboarding("noEmail");
    case "failed":
      return tOnboarding("failed");
    default:
      return tOnboarding("failed");
  }
}

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState(
    completeOnboarding,
    null as OnboardingActionState
  );

  const msg = errorMessage(state, t);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="mb-1 block text-sm font-medium text-[var(--fp-ink)]"
        >
          {t("username")}
        </label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={32}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg ? "username-error" : undefined}
          disabled={isPending}
          className="fp-field w-full min-h-11 rounded-lg border border-[var(--fp-wood-mid)]/50 px-3 py-2 text-base"
          dir="auto"
          autoComplete="username"
        />
      </div>
      {msg && (
        <p
          id="username-error"
          className="rounded-lg border border-[var(--fp-loss)]/35 bg-[var(--fp-loss)]/10 px-3 py-2 text-sm font-medium text-[var(--fp-loss-ink)]"
          role="alert"
        >
          {msg}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-11 rounded-xl bg-[var(--fp-moss)] font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {isPending ? tCommon("loading") : t("submit")}
      </button>
    </form>
  );
}
