import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";
import { ThemeInitializer } from "./theme-initializer";

export const metadata: Metadata = {
  title: "Real Time Chat",
  description: "EpiTalk",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeInitializer />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
