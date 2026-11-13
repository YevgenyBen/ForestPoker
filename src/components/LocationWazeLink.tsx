import type { ReactNode } from "react";
import { wazeUrlForAddress } from "@/lib/wazeUrl";

type Props = {
  address: string;
  /** Shown when `address` is empty (same as plain “—”). */
  emptyDisplay?: ReactNode;
  /** Accessible name / tooltip, e.g. “Open in Waze”. */
  openInWazeLabel: string;
  className?: string;
};

/**
 * Renders game “where” text as a link to Waze search when non-empty.
 */
export function LocationWazeLink({
  address,
  emptyDisplay = "—",
  openInWazeLabel,
  className = "font-medium text-[var(--fp-brass-ink)] underline decoration-[var(--fp-brass-ink)]/70 underline-offset-[3px] break-words hover:brightness-110",
}: Props) {
  const href = wazeUrlForAddress(address);
  const text = address.trim();
  if (!href || !text) return <>{emptyDisplay}</>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={openInWazeLabel}
      aria-label={`${openInWazeLabel}: ${text}`}
      className={className}
      dir="auto"
    >
      {text}
    </a>
  );
}
