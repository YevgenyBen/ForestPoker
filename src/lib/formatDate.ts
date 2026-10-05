/**
 * User-visible dates: dd/mm/yyyy in Asia/Jerusalem (numeric; en-GB locale yields day/month/year order).
 */

export const FP_DISPLAY_TIMEZONE = "Asia/Jerusalem";

const ddMmYyyyOpts: Intl.DateTimeFormatOptions = {
  timeZone: FP_DISPLAY_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

/** Calendar date only: `dd/mm/yyyy` */
export function formatDateDdMmYyyy(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", ddMmYyyyOpts).format(date);
}

/** Date and time (24h): `dd/mm/yyyy, HH:mm` (separator follows en-GB). */
export function formatDateTimeDdMmYyyyHm(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...ddMmYyyyOpts,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Time of day only (24h): `HH:mm` */
export function formatTimeHm(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: FP_DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Parsed calendar day at noon UTC (same semantics as game scheduling).
 * Accepts `yyyy-mm-dd` (legacy) or strict `dd/mm/yyyy`.
 */
export function parseScheduledCalendarDate(raw: string): Date | null {
  const s = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    if (Number.isNaN(dt.getTime())) return null;
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) {
      return null;
    }
    return dt;
  }

  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (Number.isNaN(dt.getTime())) return null;
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }
    return dt;
  }

  return null;
}

