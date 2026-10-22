import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/martian-mono";
import "./globals.css";
import { SiteHeader, SiteHeaderStatic } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";

export const metadata: Metadata = {
  title: "Andøya Addressability Tool",
  description:
    "Welchen Anteil der global gestarteten Nutzlasten kann Isar Aerospace mit Spectrum von Andøya bedienen? Analyse E0 bis E3 mit Quellen.",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-night-3 focus:px-4 focus:py-2"
        >
          Zum Inhalt springen
        </a>
        {/* useSearchParams braucht im statischen Export eine Suspense-Grenze. */}
        <Suspense fallback={<SiteHeaderStatic />}>
          <SiteHeader />
        </Suspense>
        <main id="inhalt">{children}</main>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
      </body>
    </html>
  );
}
