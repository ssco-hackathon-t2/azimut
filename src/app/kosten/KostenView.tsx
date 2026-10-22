"use client";

import { useMemo, useState } from "react";
import type { IsarDb } from "@/lib/contract";
import { useAssetJSON } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { CHART, EChart, alpha, useNarrow, valueAxis } from "@/components/charts/EChart";

export function KostenView() {
  const db = useAssetJSON<IsarDb>("data/isar/isar_data.json");
  return <Ready items={[db] as const}>{(d) => <Kosten db={d} />}</Ready>;
}

const eur = (x: number) => `${fmtNum(x, Number.isInteger(x) ? 0 : 2)} Mio. €`;

// Zeilen, deren Herkunft die Seite offenlegt; Beschriftung hier, Werte und Status aus der DB.
const INPUTS = [
  ["price_per_launch_eur_m", "Preis pro Start", "Mio. €"],
  ["fixed_cost_eur_m", "Fixkosten Betrieb pro Jahr", "Mio. €"],
  ["variable_cost_unit20_eur_m", "Variable Kosten je Rakete bei Stück 20", "Mio. €"],
  ["learning_rate", "Lernkurve (Wright)", ""],
  ["dev_cost_eur_m", "Entwicklung pro Jahr", "Mio. €"],
] as const;

/**
 * Kipppunkt der Kostenkurve. Die Seite rechnet nicht (Dokument 13): Kosten pro Start, Break-even und
 * Szenario-Ergebnisse kommen fertig aus der Isar Case DB; hier wird nur ausgewählt und mit dem Preis verglichen.
 */
function Kosten({ db }: { db: IsarDb }) {
  const curve = useMemo(
    () =>
      db.cost_curve
        .map((r) => ({ n: Number(r.launches_per_year), cost: Number(r.cost_per_launch_eur_m), variable: Number(r.variable_cost_eur_m), fixed: Number(r.fixed_cost_per_launch_eur_m), status: r.data_status }))
        .sort((a, b) => a.n - b.n),
    [db],
  );
  const kpi = (id: string) => db.derived_kpis.find((k) => k.id === id);
  const assumption = (id: string) => db.assumptions.find((a) => a.id === id);
  const beOps = kpi("break_even_ops");
  const beDev = kpi("break_even_incl_dev");
  const price = assumption("price_per_launch_eur_m");
  const dev = assumption("dev_cost_eur_m");
  // Startpunkt: Szenario „Nachfrage realistisch“, sonst erste Stützstelle.
  const startN = Number(db.scenarios.find((s) => s.id === "nachfrage_realistisch")?.launches_total);
  const startIdx = Math.max(0, curve.findIndex((r) => r.n === startN));
  const [idx, setIdx] = useState(startIdx);
  const narrow = useNarrow();

  const ready = curve.length > 1 && beOps && beDev && price;
  const p = Number(price?.value_base);
  const row = curve[Math.min(idx, curve.length - 1)];
  const covered = row ? row.cost <= p : false;
  const be = Number(beOps?.value_base);
  const beD = Number(beDev?.value_base);
  const scenario = row ? db.scenarios.find((s) => Number(s.launches_total) === row.n) : undefined;

  const option = useMemo(
    () => ({
      animation: false,
      grid: { left: 8, right: 24, top: 52, bottom: 36, containLabel: true },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => eur(v) },
      xAxis: { type: "value", min: curve[0]?.n, max: curve.at(-1)?.n, ...valueAxis(), name: "Starts pro Jahr", nameLocation: "middle", nameGap: 26 },
      // Schmal: Achsenname und lange Linienbeschriftungen würden sich überlagern; die Bildunterschrift erklärt sie.
      yAxis: { type: "value", ...valueAxis(), name: narrow ? "" : "Mio. € pro Start", nameLocation: "end", nameTextStyle: { align: "left" } },
      series: [
        {
          name: "Kosten pro Start",
          type: "line",
          color: CHART.ice,
          symbol: "circle",
          symbolSize: 6,
          data: curve.map((r) => [r.n, r.cost]),
          markLine: {
            symbol: "none",
            silent: true,
            lineStyle: { type: "dashed", color: CHART.mist },
            label: { color: CHART.ink, fontSize: 12 },
            data: [
              { yAxis: p, label: { formatter: `Preis ${fmtNum(p, 0)} Mio. €`, position: "insideEndTop" } },
              { xAxis: be, label: { formatter: narrow ? fmtNum(be) : `Break-even ${fmtNum(be)}`, position: "end" } },
              { xAxis: beD, lineStyle: { color: alpha(CHART.mist, 0.6) }, label: { formatter: narrow ? fmtNum(beD) : `inkl. Entwicklung ${fmtNum(beD)}`, position: "end" } },
            ],
          },
        },
        {
          name: "Gewählt",
          type: "scatter",
          symbolSize: 16,
          z: 5,
          color: covered ? CHART.aurora : CHART.alert,
          data: row ? [[row.n, row.cost]] : [],
          tooltip: { show: false },
        },
      ],
    }),
    [curve, row, covered, p, be, beD, narrow],
  );

  if (!ready || !row) {
    return (
      <>
        <PageHead title="Kosten pro Start" />
        <Section id="kipppunkt" title="Kostenkurve fehlt">
          <OpenItem title="Isar Case DB">Kostenkurve, Break-even oder Preis fehlen in data/isar/isar_data.json.</OpenItem>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHead title="Kosten pro Start">
        Was ein Start bei wachsender Kadenz kostet, verglichen mit dem angenommenen Preis. Die Seite rechnet nicht: Sie wählt unter den Stützstellen der Kostenkurve aus der Isar
        Case DB.
      </PageHead>
      <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
        <p className="flex items-baseline gap-2 text-[0.86rem] text-amber">
          <span aria-hidden="true" className="inline-block size-1.5 shrink-0 translate-y-[-0.1em] rounded-full bg-amber" />
          Quelle: Kopie der Isar Case DB (Tabellen cost_curve, derived_kpis, scenarios, assumptions). Nicht vom Python-Rechenkern berechnet und nicht im Prüfstand.
        </p>
      </div>

      <Section id="kipppunkt" title={`Ab ${fmtNum(be)} Starts pro Jahr deckt der Preis die Betriebskosten`}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div>
            <label htmlFor="kadenz" className="text-[0.92rem] text-mist">
              Starts pro Jahr, alle Standorte
            </label>
            <div className="mt-2 flex items-center gap-4">
              <input
                id="kadenz"
                type="range"
                min={0}
                max={curve.length - 1}
                step={1}
                value={idx}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-valuetext={`${row.n} Starts pro Jahr`}
                className="h-2 w-full cursor-pointer accent-[var(--color-ice)]"
              />
              <span className="num w-10 text-right text-[1.4rem] font-semibold text-snow">{row.n}</span>
            </div>
            <p className="mt-1 text-[0.8rem] text-mist">
              Springt zwischen den {curve.length} Stützstellen der Kostenkurve ({curve[0].n} bis {curve.at(-1)!.n}).
            </p>

            <p className="mt-8 text-[0.92rem] text-mist">Kosten pro Start bei {row.n} Starts pro Jahr</p>
            <p className="num font-display text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-[1.05] text-snow">{eur(row.cost)}</p>
            <p aria-live="polite" className={`mt-2 text-[1.05rem] ${covered ? "text-aurora" : "text-alert"}`}>
              <span className="font-semibold">{covered ? "Deckt die Betriebskosten" : "Verlust je Start"}</span>: {covered ? "unter" : "über"} dem Preis von {eur(p)}, vor
              Entwicklung.
            </p>
            <p className="mt-3 text-[0.95rem] text-mist">
              Mit Entwicklung{dev ? ` (${fmtNum(Number(dev.value_base))} Mio. € pro Jahr)` : ""} erst ab {fmtNum(beD)} Starts:{" "}
              <span className="text-snow">{row.n >= beD ? "erreicht" : "noch nicht erreicht"}</span>.
            </p>
            {scenario && (
              <p className="mt-3 border-l-2 border-rule-strong pl-3 text-[0.95rem] text-snow">
                Szenario „{scenario.name}“ {scenario.year}: Ergebnis vor Entwicklung {Number(scenario.result_eur_m) > 0 ? "+" : ""}
                {fmtNum(Number(scenario.result_eur_m))} Mio. € <span className="text-mist">({STATUS_LABELS[scenario.data_status] ?? scenario.data_status})</span>
              </p>
            )}
            <button type="button" onClick={() => setIdx(startIdx)} className="mt-6 border border-rule-strong px-3 py-1.5 text-[0.9rem] text-snow hover:border-ice">
              Zurück auf realistische Nachfrage ({curve[startIdx].n} Starts)
            </button>
          </div>

          <ChartFrame
            note={
              <>
                Kosten pro Start in Mio. € = variable Kosten mit Lernkurve plus Fixkosten je Start, als fertige Kurve aus der DB ({STATUS_LABELS[row.status] ?? row.status}).
                Senkrechte Linien: Break-even Betrieb ({fmtNum(be)}) und inklusive Entwicklung ({fmtNum(beD)}). Break-even laut DB
                zwischen {fmtNum(Number(beOps!.value_low))} und {fmtNum(Number(beOps!.value_high))} Starts, je nach Annahmen.
              </>
            }
            table={
              <table className="num w-full border-collapse text-left text-[0.9rem]">
                <thead className="text-mist">
                  <tr className="border-b border-rule">
                    <th className="py-2 pr-3 font-normal">Starts pro Jahr</th>
                    <th className="py-2 pr-3 text-right font-normal">Variabel</th>
                    <th className="py-2 pr-3 text-right font-normal">Fix je Start</th>
                    <th className="py-2 text-right font-normal">Kosten pro Start</th>
                  </tr>
                </thead>
                <tbody>
                  {curve.map((r) => (
                    <tr key={r.n} className={`border-b border-rule/50 ${r.n === row.n ? "text-snow" : "text-mist"}`}>
                      <td className="py-1.5 pr-3">{r.n}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(r.variable, 2)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(r.fixed, 2)}</td>
                      <td className="py-1.5 text-right">{fmtNum(r.cost, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <EChart option={option} height={340} label={`Kosten pro Start über Starts pro Jahr, Preislinie ${fmtNum(p, 0)} Mio. €, gewählt ${row.n} Starts.`} />
          </ChartFrame>
        </div>
      </Section>

      <Section id="herkunft" title="Die Kurve steht auf Annahmen, jede mit Status">
        <dl className="divide-y divide-rule/60 border-y border-rule text-[0.92rem]">
          {INPUTS.map(([id, label, unit]) => {
            const a = assumption(id);
            if (!a) return null;
            const src = db.sources.find((s) => s.id === a.source_id);
            return (
              <div key={id} className="grid gap-1 py-3 md:grid-cols-[18rem_12rem_1fr]">
                <dt className="text-snow">{label}</dt>
                <dd className="num text-snow">
                  {fmtNum(Number(a.value_base), 2)} {unit} <span className="text-mist">({fmtNum(Number(a.value_low), 2)} bis {fmtNum(Number(a.value_high), 2)})</span>
                </dd>
                <dd className="text-mist">
                  {STATUS_LABELS[a.data_status] ?? a.data_status}
                  {" · "}
                  {src ? <a href={src.url}>{src.publisher || src.title}</a> : "ohne Quelle"}
                </dd>
              </div>
            );
          })}
          {[beOps!, beDev!].map((k) => (
            <div key={k.id} className="grid gap-1 py-3 md:grid-cols-[18rem_12rem_1fr]">
              <dt className="text-snow">{k.id === "break_even_ops" ? "Break-even Betrieb" : "Break-even inkl. Entwicklung"}</dt>
              <dd className="num text-snow">
                {fmtNum(Number(k.value_base))} Starts <span className="text-mist">({fmtNum(Number(k.value_low))} bis {fmtNum(Number(k.value_high))})</span>
              </dd>
              <dd className="text-mist">
                {STATUS_LABELS[k.data_status] ?? k.data_status} · <span className="metric">{k.formula}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
