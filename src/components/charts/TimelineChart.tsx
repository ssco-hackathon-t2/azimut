"use client";

import { useMemo, useState } from "react";
import type { ScenarioId, TimelineRow } from "@/lib/contract";
import { fmtEurMio, fmtNum, fmtPct, fmtT } from "@/lib/format";
import { Toggle } from "@/components/ui/Toggle";
import { CHART, EChart, alpha, useNarrow, valueAxis } from "./EChart";
import { ChartFrame } from "./ChartFrame";

// Zeitzonen wie scenarios.yaml v2 (zones/zone_labels, origin/main nach 95ca89d). Werte gibt es nur dort,
// wo der Fachlauf sie liefert; mit Lieferung kommen die Beschriftungen aus meta.zone_labels.
export const ZONES = [
  { from: 1957, to: 2025, label: "beobachtet (GCAT)" },
  { from: 2026, to: 2026, label: "laufend, unvollständig" },
  { from: 2026, to: 2035, label: "modelliert" },
  { from: 2036, to: 2040, label: "Korridor, keine Prognose" },
  { from: 2041, to: 2050, label: "Treiber 2041–2050, keine Zahlen" },
];

/** Zone eines Jahres: geliefertes `zone`-Feld (scenarios.yaml v2) vor Jahresgrenzen als Rückfall. */
export function zoneLabel(year: number, row?: { zone?: string | null } & object, labels?: Record<string, string>): string {
  const z = (row as { zone?: string | null } | undefined)?.zone;
  if (z) return labels?.[z] ?? z;
  if (year <= 2025) return ZONES[0].label;
  if (year <= 2035) return ZONES[2].label;
  if (year <= 2040) return ZONES[3].label;
  return ZONES[4].label;
}

interface Props {
  rows: TimelineRow[];
  scenario: ScenarioId;
  scenarioLabels: Record<ScenarioId, string>;
  highlightYear?: number;
}

export function TimelineChart({ rows, scenario, scenarioLabels, highlightYear }: Props) {
  const [metric, setMetric] = useState<"mass" | "count">("mass");
  const [horizon, setHorizon] = useState<"model" | "2050">("model");
  const narrow = useNarrow();
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b), [rows]);
  const maxYear = horizon === "2050" ? 2050 : years[years.length - 1];
  const axisYears = useMemo(() => {
    const out: number[] = [];
    for (let y = years[0]; y <= maxYear; y++) out.push(y);
    return out;
  }, [years, maxYear]);

  const by = (sc: ScenarioId) => new Map(rows.filter((r) => r.scenario === sc).map((r) => [r.year, r]));
  const cur = by(scenario);
  const lo = by("conservative");
  const hi = by("optimistic");
  // null bleibt null (nie 0): Zonen ohne gelieferte Werte dürfen keine Linie bei 0 zeigen.
  const e2 = (r?: TimelineRow) => {
    const v = r ? (metric === "mass" ? r.e2_mass_kg : r.e2_count) : null;
    return v == null ? null : metric === "mass" ? v / 1000 : v;
  };
  const share = (r?: TimelineRow) => (r ? (metric === "mass" ? r.share_mass : r.share_count) ?? null : null);

  const option = useMemo(() => {
    const band = axisYears.map((y) => {
      const a = e2(lo.get(y));
      const b = e2(hi.get(y));
      return a === null || b === null ? [null, null] : [Math.min(a, b), Math.max(a, b)];
    });
    const label = scenarioLabels[scenario] ?? scenario;
    const markZones = [
      [{ xAxis: "2025", itemStyle: { color: alpha(CHART.ink, 0.035) }, name: "beobachtet" }, { xAxis: "2025" }],
      ...(horizon === "2050"
        ? [
            [{ xAxis: "2036", name: `${ZONES[3].label}: nicht geliefert`, itemStyle: { color: alpha(CHART.amber, 0.06) } }, { xAxis: "2040" }],
            [{ xAxis: "2041", name: ZONES[4].label, itemStyle: { color: alpha(CHART.amber, 0.035) } }, { xAxis: "2050" }],
          ]
        : []),
    ];
    return {
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: {
        trigger: "axis",
        formatter: (ps: { axisValue: string }[]) => {
          const y = Number(ps[0].axisValue);
          const r = cur.get(y);
          if (!r) return `${y}<br/>Keine gelieferten Werte`;
          const unit = metric === "mass" ? fmtT(r.e2_mass_kg) : `${fmtNum(r.e2_count, 0)} Nutzlasten`;
          const cap = r.ramp_cap === null ? "nur Standort-Cap" : `Rampen-Cap ${fmtNum(r.ramp_cap, 0)}`;
          return [
            `<b>${y}</b> · ${label} · ${zoneLabel(y, r)}${y === 2026 ? " (Beobachtung 2026 läuft noch, siehe Historie)" : ""}`,
            `E2 adressierbar: ${unit}`,
            `Anteil an E0 (Nenner fortgeschrieben): ${fmtPct(share(r), 2)}`,
            `E3 Missionen bedient: ${fmtNum(r.e3_missions_served, 1)} (nachgefragt ${fmtNum(r.e3_missions_demanded, 1)})`,
            `E3 Umsatz: ${fmtEurMio(r.e3_revenue_eur)} · ${cap}`,
          ].join("<br/>");
        },
      },
      legend: { top: 0, left: 0, orient: narrow ? "vertical" : "horizontal", itemGap: narrow ? 4 : 10, textStyle: { fontSize: narrow ? 11 : 13 } },
      grid: [
        { left: 56, right: 16, top: narrow ? 128 : 64, height: narrow ? "26%" : "34%" },
        { left: 56, right: 16, top: "55%", height: "14%" },
        { left: 56, right: 16, top: "77%", height: "17%" },
      ],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1, 2], filterMode: "none" }],
      xAxis: [0, 1, 2].map((i) => ({
        type: "category",
        gridIndex: i,
        data: axisYears.map(String),
        boundaryGap: true,
        axisLabel: { show: i === 2, fontFamily: CHART.mono },
        splitLine: { show: false },
      })),
      yAxis: [
        { gridIndex: 0, type: "value", name: metric === "mass" ? "E2 [t]" : "E2 Nutzlasten", ...valueAxis(), nameGap: 10 },
        {
          gridIndex: 1,
          type: "value",
          name: "Anteil",
          axisLabel: { fontSize: 11, formatter: (x: number) => fmtPct(x, 1) },
          splitNumber: 2,
        },
        { gridIndex: 2, type: "value", name: "E3 Missionen", ...valueAxis(), splitNumber: 2 },
      ],
      series: [
        {
          name: "Band konservativ–optimistisch",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: band.map((b) => b[0]),
          stack: "band",
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          tooltip: { show: false },
          itemStyle: { color: CHART.iceDim },
          markArea: { silent: true, label: { color: CHART.mist, fontSize: 11, position: "insideTop" }, data: markZones },
        },
        {
          name: "Band konservativ–optimistisch",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: band.map((b) => (b[0] === null || b[1] === null ? null : b[1] - b[0])),
          stack: "band",
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          areaStyle: { color: alpha(CHART.ice, 0.16) },
          itemStyle: { color: alpha(CHART.ice, 0.4) },
        },
        {
          name: `E2 ${label}`,
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: axisYears.map((y) => e2(cur.get(y))),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { color: CHART.ice, width: 2 },
          itemStyle: { color: CHART.ice },
          markLine: highlightYear
            ? { silent: true, symbol: "none", lineStyle: { color: CHART.ruleStrong, type: "dotted" }, label: { show: false }, data: [{ xAxis: String(highlightYear) }] }
            : undefined,
        },
        {
          name: "Anteil (Szenario, Nenner fortgeschrieben, keine Prognose)",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: axisYears.map((y) => share(cur.get(y))),
          symbol: "none",
          lineStyle: { color: CHART.mist, type: "dashed", width: 1.5 },
          itemStyle: { color: CHART.mist },
        },
        {
          name: `E3 Missionen bedient ${label}`,
          type: "bar",
          color: CHART.aurora,
          xAxisIndex: 2,
          yAxisIndex: 2,
          barMaxWidth: 18,
          data: axisYears.map((y) => {
            const r = cur.get(y);
            if (!r) return null;
            return {
              value: r.e3_missions_served,
              itemStyle: r.ramp_cap === null ? { color: "transparent", borderColor: CHART.aurora, borderType: "dashed" } : { color: CHART.aurora },
            };
          }),
        },
        {
          name: "Rampen-Cap (Kapazitätsobergrenze)",
          type: "scatter",
          xAxisIndex: 2,
          yAxisIndex: 2,
          symbol: "rect",
          symbolSize: [16, 2],
          itemStyle: { color: CHART.ink },
          data: axisYears.map((y) => cur.get(y)?.ramp_cap ?? null),
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, scenario, metric, horizon, axisYears, highlightYear, scenarioLabels, narrow]);

  return (
    <ChartFrame
      controls={
        <>
          <Toggle label="Größe" options={[["mass", "Masse"], ["count", "Anzahl"]]} value={metric} onChange={(v) => setMetric(v as "mass" | "count")} />
          <Toggle
            label="Zeitraum"
            options={[
              ["model", `2025–${years[years.length - 1]}`],
              ["2050", "bis 2050"],
            ]}
            value={horizon}
            onChange={(v) => setHorizon(v as "model" | "2050")}
          />
        </>
      }
      note={
        <>
          2025 beobachtet, ab 2026 Szenario (Rechenkern fortgeschrieben, keine Prognose). Gestrichelte Balken: Jahr ohne Isar-Rampe, nur Standort-Cap.
          {horizon === "2050" && " 2036–2040 (Korridor) und 2041–2050 (qualitative Treiber) liefert der Fachlauf noch nicht; hier stehen bewusst keine Werte."}
        </>
      }
      tableLabel="Zeitachse als Tabelle"
      table={
          <table className="w-full min-w-[640px] border-collapse text-left num">
            <thead className="text-mist">
              <tr className="border-b border-rule">
                {["Jahr", "E2 Masse", "E2 Anzahl", "Anteil Masse", "Missionen bedient", "Umsatz", "Rampen-Cap"].map((h) => (
                  <th key={h} className="py-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const r = cur.get(y);
                if (!r) return null;
                return (
                  <tr key={y} className="border-b border-rule/50">
                    <td className="py-1.5 pr-4 metric text-snow">{y}</td>
                    <td className="py-1.5 pr-4">{fmtT(r.e2_mass_kg)}</td>
                    <td className="py-1.5 pr-4">{fmtNum(r.e2_count, 0)}</td>
                    <td className="py-1.5 pr-4">{fmtPct(r.share_mass, 2)}</td>
                    <td className="py-1.5 pr-4">{fmtNum(r.e3_missions_served, 1)}</td>
                    <td className="py-1.5 pr-4">{fmtEurMio(r.e3_revenue_eur)}</td>
                    <td className="py-1.5 pr-4">{r.ramp_cap === null ? "nur Standort-Cap" : fmtNum(r.ramp_cap, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      }
    >
      <EChart option={option} height={560} zoomable label="Zeitachse: E2 adressierbar mit Szenarioband, Anteil an E0 und E3 Missionen je Jahr; Werte in der Tabelle darunter." />
    </ChartFrame>
  );
}
