"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { carryQuery } from "@/lib/selection";

export const NAV = [
  { href: "/", label: "Start" },
  { href: "/analyse/", label: "Analyse" },
  { href: "/kosten/", label: "Kosten" },
  { href: "/standort/", label: "Standort" },
  { href: "/historie/", label: "Historie" },
  { href: "/kapital/", label: "Kapital" },
  { href: "/belege/", label: "Belege" },
  { href: "/export/", label: "Export" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function SiteHeader() {
  const sp = useSearchParams();
  // Aktive Auswahl wandert unverändert über alle Seiten mit (ein Run für alle Ansichten);
  // geprüft wird auf der Zielseite gegen das Manifest, hier kennt der Header die Jahre nicht.
  return <HeaderBar query={carryQuery(sp)} />;
}

/** Vorgerenderte Fassung ohne Query (Suspense-Fallback): Kopfzeile steht schon im statischen HTML. */
export function SiteHeaderStatic() {
  return <HeaderBar query="" />;
}

function HeaderBar({ query }: { query: string }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-night/88 backdrop-blur-md supports-[backdrop-filter]:bg-night/72">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center gap-6 px-4 sm:px-8">
        <Link href={`/${query}`} className="flex items-baseline gap-2 no-underline" onClick={() => setOpen(false)}>
          <span className="text-[0.98rem] font-semibold tracking-[-0.01em] text-snow">Andøya</span>
          <span className="hidden text-[0.85rem] text-mist sm:inline">Addressability Tool</span>
        </Link>

        <nav aria-label="Hauptnavigation" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={`${n.href}${query}`}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-sm px-3 py-2 text-[0.92rem] no-underline transition-colors duration-200 hover:text-snow ${
                      active ? "text-snow shadow-[inset_0_-1px_0_var(--color-ice)]" : "text-mist"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-sm border border-rule px-3 text-[0.9rem] text-snow md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d={open ? "M3 3l10 10M13 3L3 13" : "M2 4h12M2 8h12M2 12h12"} stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
          Menü
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Hauptnavigation mobil" className="border-t border-rule bg-night md:hidden">
          <ul className="mx-auto max-w-[88rem] px-4 py-2">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={`${n.href}${query}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-rule/50 py-3 text-[1rem] no-underline ${active ? "text-ice" : "text-snow"}`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
