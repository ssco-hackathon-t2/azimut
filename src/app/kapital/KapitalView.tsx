"use client";

import type { ConfigFile } from "@/lib/contract";
import { useJSON } from "@/lib/data";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";

interface RefEntry {
  value?: unknown;
  unit?: string;
  source?: string;
  note?: string;
  year?: number;
  confidence?: string;
  kpi_ids?: string[];
}

function money(v: unknown, unit?: string): string {
  if (typeof v !== "number") return `${String(v ?? "–")}${unit ? ` ${unit}` : ""}`;
  const cur = unit === "EUR" ? "€" : unit === "USD" ? "US-$" : unit ?? "";
  const f = (x: number, d: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: d }).format(x);
  if (Math.abs(v) >= 1e9) return `${f(v / 1e9, 1)} Mrd. ${cur}`;
  if (Math.abs(v) >= 1e6) return `${f(v / 1e6, 0)} Mio. ${cur}`;
  return `${f(v, 2)} ${cur}`;
}

function hostOf(u?: string): string | null {
  try {
    return u?.startsWith("http") ? new URL(u).hostname : null;
  } catch {
    return null;
  }
}

export function KapitalView() {
  const config = useJSON<ConfigFile>("config.json");
  return <Ready items={[config] as const}>{(c) => <Kapital config={c} />}</Ready>;
}

function Kapital({ config }: { config: ConfigFile }) {
  // Nur Referenzwerte mit Kapitalbezug aus config/references.yaml, unverändert.
  const refs = Object.entries((config.references ?? {}) as Record<string, RefEntry>).filter(([k]) => /capital|valuation|funding|invest/i.test(k));
  return (
    <>
      <PageHead title="Kapital" />
      <Section id="referenzen" title="Belegte Referenzwerte">
        {refs.length === 0 ? (
          <p className="text-mist">Keine Kapital-Referenzen in config/references.yaml.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-sm w-full border-collapse text-left text-[0.92rem] md:min-w-[640px]">
              <thead className="text-mist">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-4 font-normal">Schlüssel</th>
                  <th className="py-2 pr-4 font-normal">Wert</th>
                  <th className="py-2 pr-4 font-normal">Jahr</th>
                  <th className="py-2 pr-4 font-normal">Quelle</th>
                  <th className="py-2 font-normal">Hinweis</th>
                </tr>
              </thead>
              <tbody>
                {refs.map(([k, r]) => (
                  <tr key={k} className="border-b border-rule/50 align-top">
                    <td className="metric py-2 pr-4 text-snow" data-label="Schlüssel">{k}</td>
                    <td className="py-2 pr-4" data-label="Wert">
                      {money(r.value, r.unit)}
                    </td>
                    <td className="py-2 pr-4" data-label="Jahr">{r.year ?? "–"}</td>
                    <td className="py-2 pr-4" data-label="Quelle">{hostOf(r.source) ? <a href={r.source}>{hostOf(r.source)}</a> : r.source ?? "–"}</td>
                    <td className="py-2 text-mist" data-label="Hinweis">
                      {r.note}
                      {r.confidence ? ` Konfidenz: ${r.confidence}.` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section id="offen" title="Erwartet vom Fachlauf">
        <div className="grid gap-4 md:grid-cols-2">
          <OpenItem title="Kapitalreihen je Zählweise">
            Privates Kapital, öffentliche Aufträge und Bewertungen getrennt gezählt, mit Quelle je Eintrag. Die Ansicht übernimmt die Reihen ohne
            eigene Umrechnung.
          </OpenItem>
          <OpenItem title="Deskriptive Verzögerungen (Lags)">
            Zeitabstand zwischen Kapitalzufluss und Startnachfrage, rein beschreibend. Keine eigene Korrelation oder Ampel in der Oberfläche.
          </OpenItem>
        </div>
      </Section>
    </>
  );
}
