import type { ReactNode } from "react";

/**
 * Einheitlicher Aufbau jedes Diagramms: Steuerung, Diagramm, Lesehinweis, Werte als Tabelle.
 * Überschrift und Aussage liefert die umgebende Section, die Herkunft die ProvenanceNote der Seite.
 */
export function ChartFrame({
  controls,
  note,
  table,
  tableLabel = "Werte als Tabelle",
  children,
}: {
  controls?: ReactNode;
  note?: ReactNode;
  table?: ReactNode;
  tableLabel?: string;
  children: ReactNode;
}) {
  return (
    <figure>
      {controls && <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">{controls}</div>}
      {children}
      {note && <figcaption className="mt-3 text-[0.85rem] text-mist measure">{note}</figcaption>}
      {table && (
        <details className="mt-3 text-[0.92rem]">
          <summary className="cursor-pointer text-mist hover:text-snow">{tableLabel}</summary>
          <div className="mt-3 overflow-x-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}
