"use client";

import { useMemo, useState } from "react";
// Startseite ist Englisch: englisches Zahlformat aus story-core, Beschriftungen aus dem Baukasten.
import { fmtNumEn as fmtNum, fmtPctEn as fmtPct, unionCount, type SitesCompare } from "@/lib/story-core";
import { CHART, EChart, alpha } from "./EChart";
import { ChartFrame } from "./ChartFrame";
import { DATA_STATUS, en, statusLabel } from "./panels/registry";

const X_MAX = 112;
const CATS = [
  ["offen", "openly addressable"],
  ["captive", "captive (e.g. Starlink)"],
  ["gesperrt", "restricted (CN/RU, US national security)"],
  ["nicht_tauglich", "not Spectrum-capable"],
] as const;

type Api = { value: (i: number) => number; coord: (v: number[]) => number[]; size: (v: number[]) => number[] };

/**
 * Neigungsleiter 0–110°: oben die Fenster der Startplätze, unten die Nutzlasten 2025 je 2°-Klasse.
 * Standorte an/aus zeigt die Union ohne Doppelzählung, nur aus gelieferten Zahlen (sites_compare.json, unions).
 */
export function InclinationLadder({ data }: { data: SitesCompare }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(data.sites.map((s) => s.id)));
  const andoya = data.sites.find((s) => s.id === "andoya");
  const union = unionCount(data, on);
  const unionE1 = on.size ? data.unions_e1?.[data.sites.filter((s) => on.has(s.id)).map((s) => s.id).join("+")] : undefined;
  const hidden = data.histogram_inc_2deg.filter((h) => h.inc_from >= X_MAX).reduce((n, h) => n + h.offen + h.captive + h.gesperrt + h.nicht_tauglich, 0);

  const option = useMemo(() => {
    const color: Record<string, string> = {
      offen: CHART.ice,
      captive: alpha(CHART.mist2, 0.55),
      gesperrt: alpha(CHART.amber, 0.55),
      nicht_tauglich: alpha(CHART.mist2, 0.22),
    };
    const bins = data.histogram_inc_2deg.filter((h) => h.inc_from < X_MAX);
    // Gestapelt: je Klasse [von, bis, Unterkante, Oberkante, Anzahl].
    const stacks = Object.fromEntries(CATS.map(([k]) => [k, [] as number[][]]));
    for (const h of bins) {
      let y = 0;
      for (const [k] of CATS) {
        const v = h[k];
        if (v > 0) stacks[k].push([h.inc_from, h.inc_from + 2, y, y + v, v]);
        y += v;
      }
    }
    const peakOpen = bins.reduce((a, b) => (b.offen > a.offen ? b : a), bins[0]);
    const peakCaptive = bins.reduce((a, b) => (b.captive > a.captive ? b : a), bins[0]);
    const top = (h: (typeof bins)[number]) => h.offen + h.captive + h.gesperrt + h.nicht_tauglich;
    const rect = (fill: string) => (_: unknown, api: Api) => {
      const p0 = api.coord([api.value(0), api.value(3)]);
      const p1 = api.coord([api.value(1), api.value(2)]);
      return { type: "rect", shape: { x: p0[0] + 0.5, y: p0[1], width: Math.max(1, p1[0] - p0[0] - 1), height: p1[1] - p0[1] }, style: { fill } };
    };
    // Abgedeckte Bereiche der eingeschalteten Fenster als Band hinter dem Histogramm.
    const bands = data.sites.filter((s) => on.has(s.id)).map((s) => [{ xAxis: s.inc_min }, { xAxis: s.inc_max }]);

    return {
      animationDuration: 900,
      grid: [
        { left: 132, right: 24, top: 8, height: 168 },
        { left: 132, right: 24, top: 214, bottom: 34 },
      ],
      tooltip: { trigger: "item", confine: true },
      xAxis: [
        { gridIndex: 0, type: "value", min: 0, max: X_MAX, axisLabel: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { opacity: 0.35 } } },
        { gridIndex: 1, type: "value", min: 0, max: X_MAX, interval: 10, axisLabel: { formatter: (v: number) => `${v}°` }, splitLine: { show: false } },
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "category",
          inverse: true,
          data: data.sites.map((s) => en(s.label)),
          axisTick: { show: false },
          axisLine: { show: false },
          axisLabel: { color: CHART.ink, fontSize: 12 },
        },
        { gridIndex: 1, type: "value", name: "Payloads 2025", nameTextStyle: { align: "left" }, axisLabel: { formatter: (v: number) => fmtNum(v, 0) } },
      ],
      series: [
        {
          type: "custom",
          name: "Window",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: data.sites.map((s, i) => ({ value: [s.inc_min, s.inc_max, i], name: en(s.label) })),
          renderItem: (_: unknown, api: Api) => {
            const i = api.value(2);
            const s = data.sites[i];
            const a = api.coord([api.value(0), i]);
            const b = api.coord([api.value(1), i]);
            const h = api.size([0, 1])[1] * 0.46;
            const lit = on.has(s.id);
            return {
              type: "rect",
              shape: { x: a[0], y: a[1] - h / 2, width: b[0] - a[0], height: h, r: 2 },
              style: { fill: lit ? (s.id === "andoya" ? CHART.ice : alpha(CHART.ice, 0.5)) : alpha(CHART.mist2, 0.16) },
            };
          },
          tooltip: {
            formatter: (p: { dataIndex: number }) => {
              const s = data.sites[p.dataIndex];
              return `${en(s.label)}<br/>Window ${fmtNum(s.inc_min, s.inc_min % 1 ? 1 : 0)} to ${s.inc_max}°<br/>openly addressable <b>${fmtNum(s.e2_count, 0)}</b> (+${fmtNum(s.e2_extra_vs_andoya, 0)} vs. Andøya)`;
            },
          },
        },
        ...CATS.map(([k, label]) => ({
          type: "custom",
          name: label,
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: stacks[k],
          renderItem: rect(color[k]),
          encode: { x: [0, 1], y: [2, 3] },
          tooltip: { formatter: (p: { value: number[] }) => `${p.value[0]} to ${p.value[1]}°: ${fmtNum(p.value[4], 0)} ${label}` },
          ...(k === "offen" ? { markArea: { silent: true, itemStyle: { color: alpha(CHART.ice, 0.06) }, data: bands } } : {}),
        })),
        {
          type: "scatter",
          xAxisIndex: 1,
          yAxisIndex: 1,
          symbolSize: 0,
          silent: true,
          tooltip: { show: false },
          data: [
            { value: [peakOpen.inc_from + 1, top(peakOpen)], label: { formatter: `${fmtNum(peakOpen.offen, 0)} open at ${peakOpen.inc_from} to ${peakOpen.inc_from + 2}°`, color: CHART.ice } },
            { value: [peakCaptive.inc_from + 1, top(peakCaptive)], label: { formatter: `${fmtNum(peakCaptive.captive, 0)} captive at ${peakCaptive.inc_from} to ${peakCaptive.inc_from + 2}°`, color: CHART.mist } },
          ],
          label: { show: true, position: "top", fontSize: 12, fontWeight: 600 },
        },
      ],
    };
  }, [data, on]);

  const toggle = (id: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ChartFrame
      controls={
        <div role="group" aria-label="Turn launch sites on and off" className="flex flex-wrap gap-2">
          {data.sites.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={on.has(s.id)}
              onClick={() => toggle(s.id)}
              className={`border px-2.5 py-1 text-[0.85rem] transition-colors duration-200 ${
                on.has(s.id) ? "border-ice/70 bg-night-3 text-snow" : "border-rule text-mist-2 line-through decoration-mist-2/60 hover:text-snow"
              }`}
            >
              {en(s.label)}
            </button>
          ))}
        </div>
      }
      note={
        <>
          Base year {data.provenance.basis_year}, same launcher and market rules, only the window changes. Calculation scripts/site_coverage.py, engine{" "}
          <span className="metric">{data.provenance.engine_commit}</span> · {DATA_STATUS[data.provenance.data_status] ?? data.provenance.data_status}
          {hidden > 0 && ` · ${fmtNum(hidden, 0)} payloads above ${X_MAX}° not shown`}
        </>
      }
      table={
        <table className="stack-sm num w-full border-collapse text-left text-[0.92rem]">
          <thead className="text-mist">
            <tr className="border-b border-rule">
              {["Launch site", "Window", "Isar status", "Technically reachable", "Openly addressable", "New vs. Andøya", "Missions/year"].map((h, i) => (
                <th key={h} className={`py-2 pr-3 font-normal ${i > 2 ? "md:text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sites.map((s) => (
              <tr key={s.id} className={`border-b border-rule/50 ${on.has(s.id) ? "text-snow" : "text-mist-2"}`}>
                <td className="py-2 pr-3">{en(s.label)}</td>
                <td className="py-2 pr-3" data-label="Window">
                  {fmtNum(s.inc_min, s.inc_min % 1 ? 1 : 0)} to {s.inc_max}°
                </td>
                <td className="py-2 pr-3" data-label="Isar status">
                  {statusLabel(s.isar_status)}
                </td>
                <td className="py-2 pr-3 md:text-right" data-label="Technically reachable">
                  {fmtPct(s.e1_share_count, 1)}
                </td>
                <td className="py-2 pr-3 md:text-right" data-label="Openly addressable">
                  {fmtNum(s.e2_count, 0)}
                </td>
                <td className="py-2 pr-3 md:text-right" data-label="New vs. Andøya">
                  {s.id === "andoya" ? "–" : `+${fmtNum(s.e2_extra_vs_andoya, 0)}`}
                </td>
                <td className="py-2 md:text-right" data-label="Missions/year">
                  {fmtNum(s.missions_per_year, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      tableLabel="Comparison as table"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_15rem]">
        <EChart option={option} height={500} label="Inclination windows of the six launch sites above the distribution of 2025 payloads by inclination, split into openly addressable, captive, restricted and not Spectrum-capable." />
        <dl className="grid content-start gap-6 border-t border-rule pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-live="polite">
          <div>
            <dt className="text-[0.82rem] text-mist">Selection, openly addressable</dt>
            <dd className="num mt-1 text-[2.4rem] font-semibold leading-none text-ice">{union == null ? "–" : fmtNum(union, 0)}</dd>
            <dd className="mt-1 text-[0.82rem] text-mist">
              {union == null || !andoya
                ? on.size
                  ? "Union not supplied for this selection"
                  : "no launch site selected"
                : `${union - andoya.e2_count >= 0 ? "+" : ""}${fmtNum(union - andoya.e2_count, 0)} vs. Andøya alone`}
            </dd>
          </div>
          <div>
            <dt className="text-[0.82rem] text-mist">Selection, technically reachable</dt>
            <dd className="num mt-1 text-[1.6rem] font-semibold leading-none text-snow">{unionE1 == null ? "–" : fmtPct(unionE1 / data.e0_count, 1)}</dd>
            <dd className="mt-1 text-[0.82rem] text-mist">of {fmtNum(data.e0_count, 0)} payloads 2025</dd>
          </div>
          <ul className="grid gap-1.5 text-[0.8rem] text-mist">
            {CATS.map(([k, label]) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`inline-block size-2.5 ${k === "offen" ? "bg-ice" : k === "captive" ? "bg-mist-2/55" : k === "gesperrt" ? "bg-amber/55" : "bg-mist-2/25"}`}
                />
                {label}
              </li>
            ))}
          </ul>
        </dl>
      </div>
    </ChartFrame>
  );
}
