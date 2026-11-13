import "./globals.css";

/**
 * Pass-through root layout. `<html>`/`<body>` are rendered by `app/[locale]/layout.tsx`
 * so `lang` and `dir` come from the URL locale in the server HTML. This layout only
 * exists because `app/page.tsx` (the `/` redirect) needs one.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
