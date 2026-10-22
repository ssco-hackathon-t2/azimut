import { Fragment, type CSSProperties } from "react";

/** flow.json["architektur"]: alle Texte der Architektur-Darstellung im Anhang (Zielbild knowledge/06_architektur.md, Abschnitt 3). */
export interface ArchitekturData {
  /** Name der Liste für Screenreader. */
  aria: string;
  /** Schichten von links nach rechts (schmal: von oben nach unten). */
  schichten: {
    id: string;
    nr: string;
    titel: string;
    tech: string;
    items: { name: string; note: string }[];
    fuss?: string;
    hervorheben?: boolean;
  }[];
  /** Beschriftung des Pfeils nach jeder Schicht; der letzte führt zum Publikum. Länge = schichten.length. */
  pfeile: string[];
  publikum: { titel: string; note: string };
  /** Datenweg, der Schichten überspringt (Case-DB-JSON ohne Rechenkern). */
  umweg: { von: string; nach: string; label: string };
  /** Automatische Prüfungen, gestrichelt unter den geprüften Schichten. */
  checks: { tag: string; titel: string; note: string; ziele: string[] }[];
  legende: { fluss: string; check: string };
}

// Ab 70rem Containerbreite (Startseite Desktop: 1184 px) liegen die Schichten nebeneinander, darunter untereinander.
// Klassen stehen deshalb ausgeschrieben mit @min-[70rem]: (Tailwind findet nur wörtliche Klassennamen).
const ARROW = 48; // px, Breite der Pfeilspalte im Desktop-Raster
const gc = (v: string) => ({ "--gc": v }) as CSSProperties;
const arrowHead = (
  <path d="M0 0 L5 7 L10 0 Z" fill="var(--color-ice-dim)" />
);

/** Architektur und Datenfluss: Kasten je Schicht, Pfeile mit laufenden Datenpunkten (globals.css .arch-dot), Prüfungen gestrichelt. */
export function ArchitectureDiagram({ d }: { d: ArchitekturData }) {
  const n = d.schichten.length;
  const idx = (id: string) => d.schichten.findIndex((s) => s.id === id);
  // Mitte von Schicht j in einer Spanne aus k Schichten mit k − 1 Pfeilspalten dazwischen.
  const mitte = (j: number, k: number) => `calc((100% - ${(k - 1) * ARROW}px) * ${2 * j + 1} / ${2 * k} + ${j * ARROW}px)`;
  const ua = idx(d.umweg.von);
  const ub = idx(d.umweg.nach);
  const uk = ub - ua + 1;
  const weiter = (i: number) => (i < n - 1 ? d.schichten[i + 1].titel : d.publikum.titel);

  return (
    <figure className="@container">
      <ol
        aria-label={d.aria}
        className="grid grid-cols-1 @min-[70rem]:[grid-template-columns:var(--cols)]"
        style={{ "--cols": `repeat(${n}, minmax(0,1fr) ${ARROW}px) minmax(0,84px)` } as CSSProperties}
      >
        {d.schichten.map((s, i) => (
          <Fragment key={s.id}>
            <li
              className={`flex flex-col border-2 bg-night-2 px-4 py-4 @min-[70rem]:row-start-2 @min-[70rem]:px-3.5 @min-[70rem]:[grid-column:var(--gc)] ${s.hervorheben ? "border-ice" : "border-rule-strong"}`}
              style={gc(String(2 * i + 1))}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ice">{s.nr}</p>
              <h3 className="mt-1 text-[19px] font-semibold leading-tight text-snow">{s.titel}</h3>
              <p className="mt-1 font-mono text-[11.5px] leading-snug text-mist-2">{s.tech}</p>
              <ul className="mb-4 mt-4 grid gap-3 @min-[36rem]:grid-cols-3 @min-[70rem]:grid-cols-1">
                {s.items.map((it) => (
                  <li key={it.name}>
                    <span className="block text-[14px] font-semibold leading-snug text-snow">{it.name}</span>
                    <span className="block text-[13px] leading-snug text-mist">{it.note}</span>
                  </li>
                ))}
              </ul>
              {s.fuss && <p className="mt-auto border-t border-rule pt-3 font-mono text-[11.5px] leading-snug text-mist">{s.fuss}</p>}
              {i === ua && (
                <p className="mt-3 font-mono text-[11.5px] leading-snug text-mist @min-[70rem]:sr-only">
                  ↳ {d.umweg.label} → {d.schichten[ub]?.titel}
                </p>
              )}
              <span className="sr-only">{` (${d.pfeile[i]} → ${weiter(i)})`}</span>
            </li>
            <Pfeil label={d.pfeile[i]} col={2 * i + 2} delay={-0.55 * i} />
          </Fragment>
        ))}

        <li
          className="flex flex-col items-center justify-center justify-self-center rounded-full border-2 border-snow/80 px-5 py-3 text-center @min-[70rem]:row-start-2 @min-[70rem]:self-center @min-[70rem]:px-2 @min-[70rem]:[grid-column:var(--gc)]"
          style={gc(String(2 * n + 1))}
        >
          <span className="text-[15px] font-semibold leading-tight text-snow">{d.publikum.titel}</span>
          <span className="text-[13px] leading-tight text-mist">{d.publikum.note}</span>
        </li>

        {ua >= 0 && ub > ua && (
          <li
            aria-hidden="true"
            className="relative hidden h-11 @min-[70rem]:row-start-1 @min-[70rem]:block @min-[70rem]:[grid-column:var(--gc)]"
            style={gc(`${2 * ua + 1} / ${2 * ub + 2}`)}
          >
            <span className="absolute bottom-0 top-3 rounded-t-md border-x border-t border-ice-dim" style={{ left: mitte(0, uk), right: mitte(0, uk) }} />
            <svg className="absolute bottom-0 translate-x-1/2" style={{ right: mitte(0, uk) }} width="10" height="7" viewBox="0 0 10 7">
              {arrowHead}
            </svg>
            <span className="absolute left-1/2 top-3 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-night px-2 font-mono text-[11px] leading-none text-mist">
              {d.umweg.label}
            </span>
          </li>
        )}

        {d.checks.map((c, ci) => {
          const z = c.ziele.map(idx).filter((x) => x >= 0);
          if (!z.length) return null;
          const a = Math.min(...z);
          const b = Math.max(...z);
          return (
            <li
              key={c.titel}
              className={`relative border border-dashed border-mist-2 px-4 py-3 ${ci === 0 ? "mt-8" : "mt-3"} @min-[70rem]:row-start-3 @min-[70rem]:mt-8 @min-[70rem]:px-3.5 @min-[70rem]:[grid-column:var(--gc)]`}
              style={gc(`${2 * a + 1} / ${2 * b + 2}`)}
            >
              {z.map((t) => (
                <span
                  key={t}
                  aria-hidden="true"
                  className="absolute bottom-full hidden h-8 border-l border-dashed border-mist-2 @min-[70rem]:block"
                  style={{ left: mitte(t - a, b - a + 1) }}
                />
              ))}
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">{c.tag}</p>
              <p className="mt-0.5 text-[14px] font-semibold leading-snug text-snow">{c.titel}</p>
              <p className="text-[13px] leading-snug text-mist">{c.note}</p>
              <p className="mt-1 font-mono text-[11px] text-mist-2 @min-[70rem]:sr-only">→ {z.map((t) => d.schichten[t].titel).join(", ")}</p>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11.5px] text-mist">
        <span className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
            <path d="M0 4 H22" stroke="var(--color-ice-dim)" />
            <path d="M21 0.5 L28 4 L21 7.5 Z" fill="var(--color-ice-dim)" />
          </svg>
          {d.legende.fluss}
        </span>
        <span className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
            <path d="M0 4 H28" stroke="var(--color-mist-2)" strokeDasharray="3 3" />
          </svg>
          {d.legende.check}
        </span>
      </figcaption>
    </figure>
  );
}

/** Pfeil nach einer Schicht: schmal senkrecht mit Beschriftung rechts, breit waagerecht mit Beschriftung darüber. */
function Pfeil({ label, col, delay }: { label: string; col: number; delay: number }) {
  return (
    <li aria-hidden="true" className="relative h-14 @min-[70rem]:row-start-2 @min-[70rem]:h-auto @min-[70rem]:[grid-column:var(--gc)]" style={gc(String(col))}>
      <span className="absolute bottom-2 left-1/2 top-1 w-px bg-ice-dim @min-[70rem]:bottom-auto @min-[70rem]:left-1.5 @min-[70rem]:right-2 @min-[70rem]:top-1/2 @min-[70rem]:h-px @min-[70rem]:w-auto">
        <span className="arch-dot" style={{ "--d": `${delay}s` } as CSSProperties} />
      </span>
      <svg
        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 @min-[70rem]:bottom-auto @min-[70rem]:left-auto @min-[70rem]:right-0.5 @min-[70rem]:top-1/2 @min-[70rem]:translate-x-0 @min-[70rem]:-translate-y-1/2 @min-[70rem]:-rotate-90"
        width="10"
        height="7"
        viewBox="0 0 10 7"
      >
        {arrowHead}
      </svg>
      <span className="absolute left-[calc(50%+14px)] top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] leading-none text-mist @min-[70rem]:left-1/2 @min-[70rem]:top-[calc(50%-7px)] @min-[70rem]:-translate-x-1/2 @min-[70rem]:-translate-y-full">
        {label}
      </span>
    </li>
  );
}
