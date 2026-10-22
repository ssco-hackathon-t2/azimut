"use client";

import { useMemo, useState } from "react";
import type { ConfigFile, EventEntry, HistoryFile, HistoryPoint, Leaf, ScenarioId } from "@/lib/contract";
import { useJSON } from "@/lib/data";
import { fmtDate, fmtNum, fmtT } from "@/lib/format";
import { SCENARIO_FALLBACK } from "@/lib/labels";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { CHART, EChart, alpha, seriesColors, useNarrow, valueAxis } from "@/components/charts/EChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Toggle } from "@/components/ui/Toggle";

const DIMS: [string, string][] = [
  ["orbit_class", "Orbitklasse"],
  ["state_group", "Staatengruppe"],
  ["vertical", "Vertical"],
  ["lv_class", "Trägerklasse"],
  ["mass_class", "Massenklasse"],
];

export function HistorieView() {
  const hist = useJSON<HistoryFile>("history.json");
  const config = useJSON<ConfigFile>("config.json");
  return <Ready items={[hist, config] as const}>{(h, c) => <Historie hist={h} config={c} />}</Ready>;
}

function Historie({ hist, config }: { hist: HistoryFile; config: ConfigFile }) {
  const [dim, setDim] = useState("orbit_class");
  const narrow = useNarrow();
  const [noCaptive, setNoCaptive] = useState(true);
  const [metric, setMetric] = useState<"count" | "mass">("count");
  const [log, setLog] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const block = hist.series?.[noCaptive ? "no_captive" : "all"] ?? {};
  const series = block[dim] ?? {};
  const years = hist.years;
  const partial = hist.partial_year?.year;
  const events = config.events?.events ?? [];
  const verticalLabels = ((config.verticals as { labels?: { value?: Record<string, string> } }).labels?.value ?? {}) as Record<string, string>;
  const nameOf = (code: string) => (dim === "vertical" ? verticalLabels[code] ?? code : code);

  // Reihenfolge nach Bestand 2025 (gelieferte Werte, nur sortiert).
  const codes = useMemo(
    () =>
      Object.keys(series).sort((a, b) => {
        const v = (c: string) => series[c].find((p) => p.year === 2025)?.[metric === "count" ? "count" : "mass_kg"] ?? 0;
        return v(b) - v(a);
      }),
    [series, metric],
  );

  const option = useMemo(() => {
    const val = (p?: HistoryPoint) => {
      if (!p) return null;
      const raw = metric === "count" ? p.count : p.mass_kg;
      if (raw == null) return null;
      const v = metric === "count" ? raw : raw / 1000;
      return log && v <= 0 ? null : v;
    };
    const evData = events
      .map((e) => ({ e, y: Number(e.date.slice(0, 4)) }))
      .filter(({ y }) => years.includes(y))
      .map(({ e, y }) => ({ value: [String(y), 0], e }));
    const palette = seriesColors();
    return {
      legend: { type: narrow ? "plain" : "scroll", top: 0, left: 0, right: 0 },
      grid: { left: 8, right: 16, top: narrow ? 120 : 56, bottom: 64, containLabel: true },
      tooltip: {
        trigger: "axis",
        formatter: (ps: { seriesName: string; value: number | null; axisValue: string; color: string; seriesType: string; data?: { e?: EventEntry } }[]) => {
          const y = ps[0]?.axisValue;
          const lines = ps
            .filter((p) => p.seriesType !== "scatter" && p.value !== null && p.value !== undefined)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .slice(0, 8)
            .map((p) => `<span style="display:inline-block;width:8px;height:8px;margin-right:6px;background:${p.color}"></span>${p.seriesName}: ${metric === "count" ? fmtNum(p.value) : fmtT((p.value ?? 0) * 1000)}`);
          const ev = events.filter((e) => e.date.startsWith(String(y)));
          const evLines = ev.slice(0, 4).map((e) => `<span style="color:${CHART.mist}">Ereignis ${fmtDate(e.date)}:</span> ${e.title} (${e.type})`);
          return [`<b>${y}</b>${Number(y) === partial ? " · laufend, unvollständig" : ""}`, ...lines, ...evLines].join("<br/>");
        },
      },
      dataZoom: [
        { type: "inside", filterMode: "none" },
        { type: "slider", height: 22, bottom: 14 },
      ],
      xAxis: { type: "category", data: years.map(String), axisLabel: { fontFamily: CHART.mono, fontSize: 11 }, splitLine: { show: false } },
      yAxis: { type: log ? "log" : "value", name: metric === "count" ? "Nutzlasten" : "t (bekannte Masse)", ...valueAxis(), min: log ? 1 : 0 },
      series: [
        ...codes.map((c, i) => ({
          name: nameOf(c),
          type: "line",
          stack: log ? undefined : "h",
          areaStyle: log ? undefined : { opacity: 0.22 },
          symbol: "none",
          lineStyle: { width: 1.2 },
          color: palette[i % palette.length],
          data: years.map((y) => val(series[c].find((p) => p.year === y))),
          markArea:
            i === 0 && partial
              ? { silent: true, itemStyle: { color: alpha(CHART.amber, 0.07) }, label: { color: CHART.amber, fontSize: 11, position: "insideTopRight" }, data: [[{ xAxis: String(partial), name: "laufend" }, { xAxis: String(partial) }]] }
              : undefined,
          markLine:
            i === 0 && metric === "mass" && hist.mass_known_reliable_from
              ? { silent: true, symbol: "none", lineStyle: { color: CHART.mist, type: "dotted" }, label: { color: CHART.mist, fontSize: 11, formatter: "Masse belastbar ab" }, data: [{ xAxis: String(hist.mass_known_reliable_from) }] }
              : undefined,
        })),
        ...(showEvents
          ? [
              {
                name: "Ereignisse",
                type: "scatter",
                symbol: "diamond",
                symbolSize: 7,
                itemStyle: { color: CHART.ink, opacity: 0.7 },
                data: evData.map((d) => ({ value: [d.value[0], log ? 1 : 0], e: d.e })),
                tooltip: { show: false },
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, series, metric, log, showEvents, years, partial, events, dim, narrow]);

  const ramps = config.analog_ramps?.ramps ?? {};
  const isar = config.analog_ramps?.isar ?? {};
  const isarRamp = (config.isar_ramp as Leaf<Record<string, Record<ScenarioId, number>>> | undefined)?.value ?? {};
  const labels = config.scenario_labels?.value ?? SCENARIO_FALLBACK;
  const rampOption = useMemo(() => {
    const maxN = 11;
    const xs = Array.from({ length: maxN }, (_, i) => `Jahr ${i + 1}`);
    const firstIsar = Number(isar.first_flight_year);
    const isarYears = Object.keys(isarRamp).map(Number).sort((a, b) => a - b);
    const roleColor: Record<string, string> = { high_form: CHART.aurora, base_form: CHART.ice, low_form: CHART.mist, demand_evidence: CHART.mist2 };
    return {
      legend: { type: "scroll", top: 0, left: 0 },
      grid: { left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: xs, splitLine: { show: false } },
      yAxis: { type: "value", name: "Starts/Jahr", ...valueAxis() },
      series: [
        ...Object.entries(ramps).map(([id, r]) => ({
          name: String((r as { name?: string }).name ?? id),
          type: "line",
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 1.4, type: (r as { role?: string }).role === "demand_evidence" ? "dotted" : "solid" },
          color: roleColor[String((r as { role?: string }).role)] ?? CHART.mist,
          data: ((r as { flights_by_year?: number[] }).flights_by_year ?? []).slice(0, maxN),
        })),
        ...(["conservative", "base", "optimistic"] as ScenarioId[]).map((sc) => ({
          name: `Isar Kapazitätsobergrenze ${labels[sc]}`,
          type: "line",
          symbol: "none",
          lineStyle: { width: sc === "base" ? 2 : 1, type: "dashed", opacity: sc === "base" ? 1 : 0.6 },
          color: CHART.ink,
          data: xs.map((_, i) => {
            const y = firstIsar + i;
            return Number.isFinite(firstIsar) && isarYears.includes(y) ? isarRamp[String(y)]?.[sc] ?? null : null;
          }),
        })),
        {
          name: "Isar beobachtet",
          type: "scatter",
          symbol: "rect",
          symbolSize: 9,
          color: CHART.ice,
          data: ((isar.observed_flights_by_year as number[]) ?? []).slice(0, maxN),
        },
      ],
    };
  }, [ramps, isar, isarRamp, labels]);

  const breaks = ((config.history_cfg?.structural_breaks as Leaf<{ id: string; year: number; label: string; years_after: number; years_before: number; series_hint?: string }[]>)?.value ?? []);

  return (
    <>
      <PageHead title="Historie">
        Gestartete Nutzlasten seit {years[0]} aus dem GCAT-Katalog, gruppiert vom Rechenkern. {partial} läuft noch und ist unvollständig.
      </PageHead>
      <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
        <ProvenanceNote p={hist.provenance} />
      </div>

      <Section id="reihen" title={`Nutzlasten je Jahr, ${years[0]}–${years[years.length - 1]}`}>
        <ChartFrame
          controls={
            <>
          <label className="flex items-center gap-3 text-[0.82rem] text-mist">
            Gruppiert nach
            <select value={dim} onChange={(e) => setDim(e.target.value)} className="h-9 border border-rule-strong bg-night-2 px-2 text-[0.92rem] text-snow">
              {DIMS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Toggle label="Größe" options={[["count", "Anzahl"], ["mass", "Masse"]]} value={metric} onChange={(v) => setMetric(v as "count" | "mass")} />
          <Toggle label="Achse" options={[["lin", "linear"], ["log", "log"]]} value={log ? "log" : "lin"} onChange={(v) => setLog(v === "log")} />
          <label className="flex items-center gap-2 text-[0.88rem] text-snow">
            <input type="checkbox" checked={noCaptive} onChange={(e) => setNoCaptive(e.target.checked)} className="size-4 accent-[var(--color-ice)]" />
            captive ausblenden
          </label>
          <label className="flex items-center gap-2 text-[0.88rem] text-snow">
            <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="size-4 accent-[var(--color-ice)]" />
            Ereignisse
          </label>
            </>
          }
          note={
            <>
              {log ? "Logarithmische Achse: Linien nicht gestapelt." : "Flächen gestapelt."} Masse nur, wo bekannt, ohne Imputation; vor{" "}
              {hist.mass_known_reliable_from ?? 1990} nur Größenordnung. Ereignisse aus config/events.yaml ({events.length}), jeweils mit Quelle.
            </>
          }
        >
          <EChart option={option} height={460} zoomable label="Zeitreihe der jährlich gestarteten Nutzlasten seit 1957, gestapelt nach gewählter Gruppe; Ereignisse als Rauten." />
        </ChartFrame>
      </Section>

      <Section
        id="rampen"
        title="Analoge Hochlaufkurven"
        intro="Starts je Jahr ab Erstflugjahr anderer Kleinträger, verglichen mit der Isar-Kapazitätsobergrenze aus assumptions.yaml. Formvergleich, keine Prognose."
      >
        <ChartFrame>
          <EChart option={rampOption} height={360} label="Analog-Rampen Electron, Vega, Alpha, Rockot, PSLV gegen Isar-Kapazitätsobergrenze je Szenario." />
        </ChartFrame>
      </Section>

      <Section id="brueche" title="Strukturbrüche" intro="Deskriptiv, keine kausale Interpretation. Das Bruchjahr selbst ist ausgeschlossen.">
        <ul className="grid gap-4 md:grid-cols-3">
          {breaks.map((b) => (
            <li key={b.id} className="border-t border-rule pt-3">
              <p className="metric text-ice">{b.year}</p>
              <p className="mt-1 text-snow">{b.label}</p>
              <p className="mt-1 text-[0.88rem] text-mist">
                {b.years_before} Jahre davor, {b.years_after} Folgejahre{b.series_hint ? `, ${b.series_hint}` : ""}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <OpenItem title="Kennzahlen je Strukturbruch (Mittelwert und Wachstum vorher/nachher)">
            engine.history.structural_break ist in INTERFACES.md beschrieben, im Rechenkern aber noch nicht umgesetzt. Die Werte folgen mit der Lieferung.
          </OpenItem>
        </div>
      </Section>
    </>
  );
}
