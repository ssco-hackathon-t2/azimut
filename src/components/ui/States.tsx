"use client";

import type { Loadable } from "@/lib/data";

export function Loading({ label = "Daten werden geladen" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-8 text-mist">
      <span className="h-px w-10 overflow-hidden bg-rule">
        <span className="block h-px w-1/2 animate-[load_1.2s_var(--ease-out-expo)_infinite] bg-ice" />
      </span>
      {label} …
      <style>{`@keyframes load{from{transform:translateX(-100%)}to{transform:translateX(200%)}}`}</style>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div role="alert" className="my-6 border border-alert/50 bg-alert/8 px-5 py-4 text-snow">
      <p className="font-medium">Diese Ansicht konnte ihre Daten nicht laden.</p>
      <p className="mt-1 text-[0.92rem] text-mist">
        {error}. Die Seite läuft ohne Server; fehlt die Datei im Export, bitte den Build prüfen.
      </p>
      {retry && (
        <button type="button" onClick={retry} className="mt-3 border border-rule-strong px-3 py-1.5 text-[0.9rem] hover:border-ice">
          Erneut laden
        </button>
      )}
    </div>
  );
}

/** Rendert Kinder erst, wenn alle Dateien geladen sind; zeigt sonst Laden oder Fehler. */
export function Ready<T extends unknown[]>({
  items,
  children,
}: {
  items: { [K in keyof T]: Loadable<T[K]> };
  children: (...data: T) => React.ReactNode;
}) {
  const err = items.find((i) => i.state === "error");
  if (err && err.state === "error") return <ErrorState error={err.error} retry={err.retry} />;
  if (items.some((i) => i.state === "loading")) return <Loading />;
  const data = items.map((i) => (i as { data: unknown }).data) as T;
  return <>{children(...data)}</>;
}

/** Sichtbar offene Funktion: nicht geliefert, nicht durch eigene Daten ersetzt. */
export function OpenItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-amber/60 px-5 py-4">
      <p className="text-[0.95rem] font-medium text-amber">Offen: {title}</p>
      <div className="mt-1 text-[0.92rem] text-mist">{children}</div>
    </div>
  );
}
