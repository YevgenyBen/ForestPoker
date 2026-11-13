"use client";

import { ActionRefreshProvider, useActionRefresh } from "@/hooks/useActionRefresh";
import { Spinner } from "@/components/Spinner";

function Overlay({ children }: { children: React.ReactNode }) {
  const { pending } = useActionRefresh();

  return (
    <div className="relative flex flex-col gap-6">
      {children}
      {pending && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[var(--fp-bg)]/55 backdrop-blur-[2px]"
          aria-busy="true"
          aria-live="polite"
        >
          <Spinner className="size-8 text-[var(--fp-moss-ink)]" />
        </div>
      )}
    </div>
  );
}

export function ActionRefreshBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ActionRefreshProvider>
      <Overlay>{children}</Overlay>
    </ActionRefreshProvider>
  );
}
