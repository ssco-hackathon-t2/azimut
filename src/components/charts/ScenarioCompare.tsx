"use client";

import { useMemo } from "react";
import type { Run, ScenarioId } from "@/lib/contract";
import { fmtEurMio, fmtNum, fmtPct, fmtT } from "@/lib/format";
import { CHART, EChart, alpha, valueAxis } from "./EChart";

/** Vorbereitete Szenarien desselben Jahres und Scopes nebeneinander (nur gelieferte Runs). */
export function ScenarioCompare({ runs, active, labels }: { runs: Run[]; active: ScenarioId; labels: Record<ScenarioId, string> }) {
  const order: ScenarioId[] = ["conservative", "base", "optimistic"];
  const rows = useMemo(() => order.map((sc) => runs.find((r) => r.params.scenario === sc)).filter(Boolean) as Run[],
    // Schlüssel über Run-IDs: der Aufrufer filtert bei jedem Rendern neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs.map((r) => r.run_id).join("|")],
  );
  const option = useMemo(
    () => ({
      legend: { top: 0, left: 0 },
      grid: { left: 8, right: 24, top: 34, bottom: 30, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", ...valueAxis(), name: "Missionen/Jahr", nameLocation: "middle", nameGap: 26 },
      yAxis: {
        type: "category",
        inverse: true,
        data: rows.map((r) => labels[r.params.scenario]),
        axisLabel: { color: CHART.ink, fontSize: 13 },
        splitLine: { show: false },
      },
      series: [
        {
          name: "E3 bedient",
          type: "bar",
          color: CHART.aurora,
          barMaxWidth: 16,
          data: rows.map((r) => ({
            value: r.e3.missions_served,
            itemStyle: { color: r.params.scenario === active ? CHART.aurora : alpha(CHART.aurora, 0.35) },
          })),
          label: { show: true, position: "right", color: CHART.ink, formatter: (p: { value: number }) => fmtNum(p.value, 1) },
        },
        {
          name: "E3 nachgefragt",
          type: "scatter",
          color: CHART.ink,
          symbol: "rect",
          symbolSize: [2, 18],
          itemStyle: { color: CHART.ink },
          data: rows.map((r) => r.e3.missions_demanded),
        },
      ],
    }),
    [rows, active, labels],
  );
  // Im Basisjahr sind alle Szenarien gleich (beobachtet); das ist kein Fehler, sondern gehört gesagt.
  const identical = rows.length > 1 && rows.every((r) => r.e3.missions_served === rows[0].e3.missions_served && r.stages[2]?.mass_kg === rows[0].stages[2]?.mass_kg);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      {identical && (
        <p className="text-[0.88rem] text-amber lg:col-span-2">
          Im Jahr {rows[0].params.year} sind die vorbereiteten Szenarien identisch: Szenarien wirken erst ab 2026 (Fortschreibung). Für einen Vergleich ein späteres Jahr wählen.
        </p>
      )}
      <EChart option={option} height={200} label="E3 Missionen je vorbereitetem Szenario; Strich = nachgefragt." />
      <div className="overflow-x-auto">
        <table className="stack-sm num w-full border-collapse text-left text-[0.92rem] md:min-w-[480px]">
          <thead className="text-mist">
            <tr className="border-b border-rule">
              <th className="py-2 pr-3 font-normal">Szenario</th>
              <th className="py-2 pr-3 text-right font-normal">E2 Masse</th>
              <th className="py-2 pr-3 text-right font-normal">E2-Anteil</th>
              <th className="py-2 pr-3 text-right font-normal">Missionen</th>
              <th className="py-2 text-right font-normal">Umsatz</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const e2 = r.stages.find((s) => s.name === "E2")!;
              const on = r.params.scenario === active;
              return (
                <tr key={r.run_id} className={`border-b border-rule/50 ${on ? "text-snow" : "text-mist"}`}>
                  <td className="py-2 pr-3">
                    {labels[r.params.scenario]}
                    {on && <span className="sr-only"> (aktiv)</span>}
                  </td>
                  <td className="py-2 pr-3 md:text-right" data-label="E2 Masse">{fmtT(e2.mass_kg)}</td>
                  <td className="py-2 pr-3 md:text-right" data-label="E2-Anteil">{fmtPct(e2.share_mass, 2)}</td>
                  <td className="py-2 pr-3 md:text-right" data-label="Missionen">{fmtNum(r.e3.missions_served, 1)}</td>
                  <td className="py-2 md:text-right" data-label="Umsatz">{fmtEurMio(r.e3.revenue_eur)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
