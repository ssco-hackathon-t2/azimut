"use client";

import { useMemo, useState } from "react";
import type { Run, StageName } from "@/lib/contract";
import { fmtNum, fmtT } from "@/lib/format";
import { Toggle } from "@/components/ui/Toggle";
import { CHART, EChart } from "./EChart";
import { ChartFrame } from "./ChartFrame";

/** Verticals einer Stufe aus run.by_vertical (geliefert, Σ = Stufe). Nur Sortierung, keine Aggregation. */
export function VerticalBars({ run, labels }: { run: Run; labels: Record<string, string> }) {
  const [stage, setStage] = useState<StageName>("E2");
  const [metric, setMetric] = useState<"mass" | "count">("mass");
  const rows = useMemo(
    () =>
      (run.by_vertical ?? [])
        .filter((r) => r.stage === stage)
        .map((r) => ({ ...r, v: metric === "mass" ? r.mass_kg : r.count }))
        .filter((r) => r.v > 0)
        .sort((a, b) => a.v - b.v),
    [run, stage, metric],
  );
  const option = useMemo(
    () => ({
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis", axisPointer: { type: "none" } },
      xAxis: { type: "value", axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: rows.map((r) => labels[r.vertical] ?? r.vertical),
        axisLabel: { color: CHART.ink },
        axisTick: { show: false },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 12,
          itemStyle: { color: stage === "E3" ? CHART.aurora : CHART.ice },
          data: rows.map((r) => r.v),
          label: {
            show: true,
            position: "right",
            color: CHART.mist,
            fontSize: 12,
            formatter: (p: { value: number }) => (metric === "mass" ? fmtT(p.value) : fmtNum(p.value, p.value % 1 ? 1 : 0)),
          },
        },
      ],
    }),
    [rows, labels, stage, metric],
  );
  if (!run.by_vertical) return <p className="text-mist">No vertical breakdown delivered in this run.</p>;
  return (
    <ChartFrame
      controls={
        <>
          <Toggle label="Stage" options={(["E0", "E1", "E2", "E3"] as StageName[]).map((s) => [s, s])} value={stage} onChange={(v) => setStage(v as StageName)} />
          <Toggle label="Metric" options={[["mass", "Mass"], ["count", "Count"]]} value={metric} onChange={(v) => setMetric(v as "mass" | "count")} />
        </>
      }
    >
      <EChart option={option} height={Math.max(220, rows.length * 30 + 20)} label={`Verticals of stage ${stage} by ${metric === "mass" ? "mass" : "count"}.`} />
    </ChartFrame>
  );
}
