"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  updatePlayerProfile,
  type UpdateProfileState,
} from "@/actions/player";

function errorMessage(
  state: UpdateProfileState,
  t: (key: string) => string
): string | null {
  if (!state || !("error" in state)) return null;
  switch (state.error) {
    case "invalid_username":
      return t("invalidUsername");
    case "invalid_location":
      return t("invalidLocation");
    case "taken":
      return t("taken");
    case "failed":
      return t("failed");
    default:
      return t("failed");
  }
}

type Props = {
  initialUsername: string;
  initialLocation: string;
};

export function PlayerProfileForm({
  initialUsername,
  initialLocation,
}: Props) {
  const t = useTranslations("player");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updatePlayerProfile,
    null as UpdateProfileState
  );

  const msg = errorMessage(state, t);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="profile-username"
          className="mb-1 block text-sm font-medium text-[var(--fp-ink)]"
        >
          {t("username")}
        </label>
        <input
          id="profile-username"
          name="username"
          required
          minLength={3}
          maxLength={32}
          defaultValue={initialUsername}
          disabled={isPending}
          aria-invalid={msg ? true : undefined}
          aria-describedby={msg ? "profile-error" : "profile-username-hint"}
          className="fp-field w-full min-h-11 rounded-lg border border-[var(--fp-wood-mid)]/50 px-3 py-2 text-base"
          dir="auto"
          autoComplete="username"
        />
        <p
          id="profile-username-hint"
          className="mt-1 text-xs text-[var(--fp-secondary)]"
        >
          {t("usernameHint")}
        </p>
      </div>

      <div>
        <label
          htmlFor="profile-location"
          className="mb-1 block text-sm font-medium text-[var(--fp-ink)]"
        >
          {t("location")}
        </label>
        <input
          id="profile-location"
          name="location"
          maxLength={500}
          aria-describedby="profile-location-hint"
          defaultValue={initialLocation}
          disabled={isPending}
          className="fp-field w-full min-h-11 rounded-lg border border-[var(--fp-wood-mid)]/50 px-3 py-2 text-base"
          dir="auto"
          autoComplete="street-address"
        />
        <p id="profile-location-hint" className="mt-1 text-xs text-[var(--fp-secondary)]">
          {t("locationHint")}
        </p>
      </div>

      {state && "ok" in state && state.ok ? (
        <p
          className="rounded-lg border border-[var(--fp-win)]/35 bg-[var(--fp-win)]/12 px-3 py-2 text-sm font-medium text-[var(--fp-moss-ink)]"
          role="status"
        >
          {t("saved")}
        </p>
      ) : null}

      {msg ? (
        <p
          id="profile-error"
          className="rounded-lg border border-[var(--fp-loss)]/35 bg-[var(--fp-loss)]/10 px-3 py-2 text-sm font-medium text-[var(--fp-loss-ink)]"
          role="alert"
        >
          {msg}
        </p>
      ) : null}

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
