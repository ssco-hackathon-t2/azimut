import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "@fontsource-variable/red-hat-display";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import { SiteHeader, SiteHeaderStatic } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { StarField } from "@/components/shell/StarField";

export const metadata: Metadata = {
  title: "Azimut",
  description:
    "What share of payloads launched worldwide can Isar Aerospace serve with Spectrum from Andøya? Analysis E0 to E3 with sources.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StarField />
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-night-3 focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {/* useSearchParams braucht im statischen Export eine Suspense-Grenze. */}
        <Suspense fallback={<SiteHeaderStatic />}>
          <SiteHeader />
        </Suspense>
        <main id="inhalt">{children}</main>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
        <ChatAssistant />
      </body>
    </html>
  );
}
