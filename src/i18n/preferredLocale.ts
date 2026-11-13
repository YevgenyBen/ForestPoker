/**
 * Best supported locale for an `Accept-Language` header, by q-value then order.
 * Matches on the primary subtag only (`he-IL` → `he`; legacy `iw` → `he`).
 */
export function preferredLocale<L extends string>(
  acceptLanguage: string | null | undefined,
  locales: readonly L[],
  fallback: L
): L {
  if (!acceptLanguage) return fallback;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      let base = tag.trim().toLowerCase().split("-")[0] ?? "";
      if (base === "iw") base = "he";
      return { base, q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((r) => r.base && r.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const r of ranked) {
    const match = locales.find((l) => l === r.base);
    if (match) return match;
  }
  return fallback;
}
