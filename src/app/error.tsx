"use client";

import Link from "next/link";

// Fehlergrenze für alle Seiten: eine unerwartete Datenform zeigt eine verständliche Meldung statt einer leeren Seite.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-[88rem] px-4 py-16 sm:px-8">
      <h1 className="text-[2rem] font-semibold">Diese Ansicht konnte nicht dargestellt werden</h1>
      <p className="mt-3 max-w-[64ch] text-mist">
        Wahrscheinlich passt eine gelieferte Datei nicht zum erwarteten Format. Die übrigen Ansichten funktionieren weiter.
      </p>
      <p className="metric mt-4 text-alert">{error.message}</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="bg-ice px-4 py-2 text-[0.92rem] font-medium text-night hover:bg-snow">
          Erneut versuchen
        </button>
        <Link href="/" className="border border-rule-strong px-4 py-2 text-[0.92rem] no-underline hover:border-ice">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
