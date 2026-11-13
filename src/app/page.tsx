import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { preferredLocale } from "@/i18n/preferredLocale";

/**
 * Fallback for `/` when the middleware didn't redirect: pick the locale from
 * `Accept-Language`. Smart routing happens in `/[locale]/page.tsx`.
 */
export default async function RootPage() {
  const acceptLanguage = (await headers()).get("accept-language");
  redirect(`/${preferredLocale(acceptLanguage, routing.locales, routing.defaultLocale)}`);
}
