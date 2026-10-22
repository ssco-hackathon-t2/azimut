"use client";

import { useMemo, useState } from "react";
import type { Run, StageName } from "@/lib/contract";
import { REASON_LABELS, STAGE_LABELS } from "@/lib/labels";
import { fmtNum, fmtPct, fmtT } from "@/lib/format";
import { Toggle } from "@/components/ui/Toggle";
import { CHART, EChart, useNarrow } from "./EChart";
import { ChartFrame } from "./ChartFrame";

type Metric = "mass" | "count";

const REASON_ORDER: Record<StageName, string[]> = {
  E0: [],
  E1: ["ORBIT_UNKNOWN", "INC_OUT", "ALT_OUT", "MASS_OUT"],
  E2: ["CAPTIVE", "GEO_BLOCK", "US_NATSEC"],
  E3: ["WINRATE", "CAPACITY"],
};

// Kurzformen für schmale Bildschirme; volle Bezeichnung im Tooltip und in der Tabelle.
const SHORT: Record<string, string> = {
  ORBIT_UNKNOWN: "Orbit ?",
  INC_OUT: "Inklin.",
  ALT_OUT: "Höhe",
  MASS_OUT: "Masse",
  CAPTIVE: "Captive",
  GEO_BLOCK: "Staat",
  US_NATSEC: "US-NatSec",
  WINRATE: "Win-Rate",
  CAPACITY: "Kapaz.",
};
const LONG: Record<string, string> = {
  ORBIT_UNKNOWN: "Orbit\nunbekannt",
  INC_OUT: "Inklination",
  ALT_OUT: "Höhe",
  MASS_OUT: "Masse",
  CAPTIVE: "Captive",
  GEO_BLOCK: "Staat",
  US_NATSEC: "US-NatSec",
  WINRATE: "Win-Rate",
  CAPACITY: "Kapazität",
};

interface Bar {
  label: string;
  kind: "stage" | "reason";
  stage: StageName;
  code?: string;
  value: number;
  base: number;
  share?: number;
}

/** Wasserfall aus gelieferten Stufen und Ausschlussgründen (Σ Gründe + Stufe = Vorstufe, Engine-Invariante). */
function bars(run: Run, metric: Metric): Bar[] {
  const v = (x: { count: number; mass_kg: number }) => (metric === "mass" ? x.mass_kg : x.count);
  const out: Bar[] = [];
  const stages = Object.fromEntries(run.stages.map((s) => [s.name, s]));
  (["E0", "E1", "E2", "E3"] as StageName[]).forEach((name) => {
    const s = stages[name];
    if (name !== "E0") {
      let top = v(stages[(["E0", "E1", "E2", "E3"] as StageName[])[["E0", "E1", "E2", "E3"].indexOf(name) - 1]]);
      for (const code of REASON_ORDER[name]) {
        const r = run.reasons.find((x) => x.reason === code && x.stage === name);
        if (!r) continue;
        const val = v(r);
        if (val <= 0) continue;
        top -= val;
        out.push({ label: REASON_LABELS[code] ?? code, kind: "reason", stage: name, code, value: val, base: Math.max(top, 0) });
      }
    }
    out.push({
      label: STAGE_LABELS[name],
      kind: "stage",
      stage: name,
      value: v(s),
      base: 0,
      share: metric === "mass" ? s.share_mass : s.share_count,
    });
  });
  return out;
}

export function FunnelWaterfall({ run, metric: initial = "mass" }: { run: Run; metric?: Metric }) {
  const [metric, setMetric] = useState<Metric>(initial);
  // Standard: ab E1 vergrößert, damit E2 und E3 lesbar sind; E0 bleibt mit vollem Wert beschriftet.
  const [lens, setLens] = useState(true);
  const narrow = useNarrow();
  const data = useMemo(() => bars(run, metric), [run, metric]);
  const fmt = (x: number) => (metric === "mass" ? fmtT(x) : fmtNum(x, x % 1 ? 1 : 0));
  const e1 = run.stages.find((s) => s.name === "E1");
  const yMax = lens && e1 ? (metric === "mass" ? e1.mass_kg : e1.count) * 1.08 : undefined;

  const option = useMemo(
    () => ({
      grid: { left: 8, right: 8, top: 48, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (ps: { dataIndex: number }[]) => {
          const b = data[ps[0].dataIndex];
          const head = b.kind === "stage" ? b.label : `Abzug: ${b.label}`;
          const extra = b.share !== undefined ? `<br/>Anteil an E0: ${fmtPct(b.share, 2)}` : "";
          return `${head}<br/><b>${fmt(b.value)}</b>${extra}`;
        },
      },
      xAxis: {
        type: "category",
        data: data.map((b) => (b.kind === "stage" ? b.stage : b.code)),
        axisLabel: {
          fontSize: narrow ? 10 : 11,
          interval: 0,
          rotate: narrow ? 90 : 0,
          formatter: (code: string) => (code.startsWith("E") && code.length === 2 ? `{s|${code}}` : narrow ? SHORT[code] ?? code : LONG[code] ?? code),
          rich: { s: { color: CHART.ink, fontWeight: 600, fontSize: 13 } },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        max: yMax,
        min: 0,
        name: metric === "mass" ? "t" : "Nutzlasten",
        axisLabel: { formatter: (x: number) => (metric === "mass" ? fmtNum(x / 1000, 0) : fmtNum(x, 0)) },
      },
      series: [
        // Vergrößerung: Balken [Basis, Basis + Wert] auf [0, yMax] beschneiden (Basis und Oberkante).
        { type: "bar", stack: "w", silent: true, itemStyle: { color: "transparent" }, data: data.map((b) => (lens && yMax ? Math.min(b.base, yMax) : b.base)) },
        {
          type: "bar",
          stack: "w",
          barMaxWidth: 46,
          data: data.map((b) => ({
            value: lens && yMax ? Math.max(0, Math.min(b.base + b.value, yMax) - Math.min(b.base, yMax)) : b.value,
            itemStyle: {
              color: b.kind === "reason" ? CHART.deduct : b.stage === "E3" ? CHART.aurora : b.stage === "E2" ? CHART.ice : CHART.iceDim,
              borderColor: b.kind === "reason" ? CHART.mist2 : "transparent",
              borderWidth: b.kind === "reason" ? 1 : 0,
            },
          })),
          label: {
            show: true,
            position: "top",
            color: CHART.ink,
            fontSize: narrow ? 10 : 11,
            formatter: (p: { dataIndex: number }) => {
              const b = data[p.dataIndex];
              // Schmal: nur Stufen beschriften, Abzüge stehen im Tooltip und in der Tabelle.
              if (narrow) return b.kind === "stage" ? fmtPct(b.share, 2) : "";
              return b.kind === "stage" ? `${fmt(b.value)}\n${fmtPct(b.share, 2)}` : `−${fmt(b.value)}`;
            },
          },
        },
      ],
    }),
    [data, metric, lens, yMax, narrow],
  );

  return (
    <ChartFrame
      controls={
        <>
          <Toggle
            label="Größe"
            options={[
              ["mass", "Masse"],
              ["count", "Anzahl"],
            ]}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
          <Toggle
            label="Maßstab"
            options={[
              ["all", "Gesamt"],
              ["lens", "Ab E1 vergrößert"],
            ]}
            value={lens ? "lens" : "all"}
            onChange={(v) => setLens(v === "lens")}
          />
        </>
      }
      note={lens && "Vergrößerte Ansicht: Balken über E1 sind abgeschnitten, die Beschriftung zeigt den vollen Wert."}
      tableLabel="Wasserfall als Tabelle"
      table={
        <table className="w-full border-collapse text-left num">
          <thead className="text-mist">
            <tr className="border-b border-rule">
              <th className="py-2 pr-4 font-normal">Schritt</th>
              <th className="py-2 pr-4 text-right font-normal">{metric === "mass" ? "Masse" : "Anzahl"}</th>
              <th className="py-2 text-right font-normal">Anteil an E0</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <tr key={i} className="border-b border-rule/50">
                <td className={`py-1.5 pr-4 ${b.kind === "stage" ? "text-snow" : "pl-4 text-mist"}`}>
                  {b.kind === "reason" ? `− ${b.label} (${b.code})` : b.label}
                </td>
                <td className="py-1.5 pr-4 text-right">{fmt(b.value)}</td>
                <td className="py-1.5 text-right">{b.share !== undefined ? fmtPct(b.share, 2) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <EChart
        option={option}
        height={380}
        label={`Wasserfall E0 bis E3 nach ${metric === "mass" ? "Masse" : "Anzahl"}; Werte auch in der Tabelle darunter.`}
      />
    </ChartFrame>
  );
}
