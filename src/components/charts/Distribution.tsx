"use client";

import { useMemo } from "react";
import { fmtNum } from "@/lib/format";
import { CHART, EChart, alpha, valueAxis } from "./EChart";

/** Histogramm aus gelieferten Klassen (Kanten + Zählung). Fenster/Schwellen als Markierungen. */
export function Distribution({
  edges,
  counts,
  xName,
  label,
  log = false,
  bands = [],
  lines = [],
  height = 300,
}: {
  edges: number[];
  counts: number[];
  xName: string;
  label: string;
  log?: boolean;
  bands?: { from: number; to: number; name: string; strong?: boolean }[];
  lines?: { at: number; name: string; dashed?: boolean }[];
  height?: number;
}) {
  const option = useMemo(() => {
    const data = counts.map((c, i) => [edges[i], edges[i + 1], c]);
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "item",
        formatter: (p: { value: number[] }) => `${fmtNum(p.value[0], log ? 0 : 0)}–${fmtNum(p.value[1], log ? 0 : 0)} ${xName}<br/><b>${fmtNum(p.value[2])}</b> Nutzlasten`,
      },
      dataZoom: [{ type: "inside", filterMode: "none" }],
      xAxis: {
        type: log ? "log" : "value",
        min: edges[0] > 0 ? edges[0] : 0,
        max: edges[edges.length - 1],
        name: xName,
        nameLocation: "middle",
        nameGap: 28,
        ...valueAxis(),
        splitLine: { show: false },
      },
      yAxis: { type: "value", name: "Nutzlasten", ...valueAxis() },
      series: [
        {
          type: "custom",
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[]; style: (o: object) => object }) => {
            const a = api.coord([api.value(0), api.value(2)]);
            const b = api.coord([api.value(1), 0]);
            return { type: "rect", shape: { x: a[0] + 0.5, y: a[1], width: Math.max(1, b[0] - a[0] - 1), height: b[1] - a[1] }, style: api.style({ fill: CHART.mist, opacity: 0.75 }) };
          },
          encode: { x: [0, 1], y: 2 },
          data,
          markArea: {
            silent: true,
            label: { color: CHART.ink, fontSize: 11, position: "insideTop" },
            data: bands.map((b) => [
              { xAxis: b.from, name: b.name, itemStyle: { color: alpha(CHART.ice, b.strong ? 0.16 : 0.06), borderColor: CHART.ice, borderWidth: b.strong ? 0 : 1, borderType: "dotted" } },
              { xAxis: b.to },
            ]),
          },
          markLine: {
            silent: true,
            symbol: "none",
            label: { color: CHART.ink, fontSize: 11, formatter: "{b}" },
            data: lines.map((l, i) => ({
              xAxis: l.at,
              name: l.name,
              label: { position: i % 2 ? "insideEndBottom" : "insideEndTop", distance: 4 },
              lineStyle: { color: l.dashed ? CHART.mist : CHART.ice, type: l.dashed ? "dashed" : "solid" },
            })),
          },
        },
      ],
    };
  }, [edges, counts, xName, log, bands, lines]);
  return <EChart option={option} height={height} zoomable label={label} />;
}
