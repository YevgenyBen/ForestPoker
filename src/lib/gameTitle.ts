/**
 * Game titles are stored in a fixed, language-neutral-ish form: `Game {n} - dd/mm/yyyy`
 * (see `nextGameTitle` in `actions/games.ts`). This module turns that stored form
 * back into its parts so each locale can render its own title.
 */

export type GameTitleParts = { serial: number; date: string };

const STORED_TITLE = /^Game (\d+) - (\d{2}\/\d{2}\/\d{4})$/;

export function formatStoredGameTitle(serial: number, date: string): string {
  return `Game ${serial} - ${date}`;
}

export function parseStoredGameTitle(title: string): GameTitleParts | null {
  const m = STORED_TITLE.exec(title.trim());
  if (!m) return null;
  return { serial: Number(m[1]), date: m[2]! };
}

/**
 * Localized title for display. Titles that don't match the stored pattern
 * (e.g. edited by hand) are shown as-is.
 */
export function localizeGameTitle(
  title: string,
  format: (parts: GameTitleParts) => string
): string {
  const parts = parseStoredGameTitle(title);
  return parts ? format(parts) : title;
}
