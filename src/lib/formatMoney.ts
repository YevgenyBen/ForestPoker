const formatters = new Map<string, Intl.NumberFormat>();

/** Whole-shekel currency string for the given app locale, e.g. "₪130" / "‏130 ₪". */
export function formatNis(locale: string, n: number): string {
  const intlLocale = locale === "he" ? "he-IL" : "en-IL";
  let f = formatters.get(intlLocale);
  if (!f) {
    f = new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    });
    formatters.set(intlLocale, f);
  }
  return f.format(n);
}
