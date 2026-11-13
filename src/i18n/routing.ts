import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "he"],
  defaultLocale: "en",
  localePrefix: "always",
  /**
   * Unprefixed URLs (e.g. `/`) pick the locale from the `Accept-Language` header.
   * Prefixed URLs (/en/..., /he/...) always win.
   */
  localeDetection: true,
  /** No NEXT_LOCALE cookie (conflicts with Firebase Hosting __session budget). */
  localeCookie: false,
});
