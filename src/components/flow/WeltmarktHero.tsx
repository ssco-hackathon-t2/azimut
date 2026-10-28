"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type PointerEvent } from "react";
import type { Tables } from "@/lib/story";
import type { View } from "./Globe";
import { nf } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

type Q = [number, number, number];
/** Satelliten je Jahr, P10/P50/P90: demand = benötigt ohne Startgrenze, served = gestartet = min(Bedarf, Kapazität), gap = Bedarf − gestartet, open = ohne captive. */
interface McYear {
  year: number;
  demand: Q;
  served: Q;
  gap: Q;
  open?: Q;
  /** Anteil der Läufe, in denen der Bedarf die Kapazität übersteigt. */
  p_gap?: number;
}

/** public/data/demand/global_demand_mc.json (scripts/export_demand_mc.py). Die Slide nutzt demand_mc: neuester Lauf je Starship-Szenario aus Supabase. */
export interface DemandMC {
  fetched_at: string;
  demand_mc: null | {
    source: string;
    fan_from: number;
    vehicles: number;
    history: { year: number; sats: number }[];
    scenarios: Record<string, { run_id: string; draws: number; seed: number; created_at: string; years: McYear[] }>;
  };
}

type Text =
  | "titel"
  | "titel_ohne"
  | "needed"
  | "needed_info"
  | "launched"
  | "launched_info"
  | "gap"
  | "gap_info"
  | "keine"
  | "leg_launched"
  | "leg_gap"
  | "leg_unit"
  | "starship"
  | "jahr"
  | "jahr_zurueck"
  | "jahr_vor"
  | "fan"
  | "methode"
  | "globus";

export interface Weltmarkt {
  home: View;
  /** Startjahr und Start-Szenario (id aus demand_mc.scenarios). */
  jahr: number;
  szenario: string;
  /** Starship-Schalter in Anzeigereihenfolge. */
  szenarien: { id: string; label: string }[];
  /** Erstes Jahr der Zeitleiste (davor keine Historie). */
  von: number;
  /** Satelliten je Punkt im Ring um den Globus. */
  punkt: number;
  /** Platzhalter {name} werden aus den Daten gefüllt (year, need, sup, gap, captive, p, runs, …). */
  texte: Record<Text, string>;
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const W = 1000;
const H = 200;
const RINGS = 3;

/**
 * Einstieg „World market“ (Zielbild 22.10.): links benötigt → gestartet → Lücke für das gewählte Jahr, daneben der Globus
 * mit Punktring (weiß = gestartet, rot hohl = ohne Rakete), darunter der Monte Carlo über die Zeit, Starship-Schalter.
 * Fehlen Part oder Export (alter Stand in flow.json), bleibt die Fläche leer statt abzustürzen.
 */
export function WeltmarktHero({ d, mc }: { d: Weltmarkt; t: Tables; mc?: DemandMC }) {
  const m = mc?.demand_mc;
  const ok = d?.texte && d.szenarien?.length && m?.scenarios && Object.values(m.scenarios).some((s) => s.years?.length);
  return ok ? <Einstieg d={d} m={m!} /> : <section id="einstieg" aria-busy="true" className="min-h-[calc(100svh-var(--header-h))]" />;
}

function Einstieg({ d, m }: { d: Weltmarkt; m: NonNullable<DemandMC["demand_mc"]> }) {
  const T = d.texte;
  const ids = d.szenarien.filter((s) => m.scenarios[s.id]?.years?.length);
  const [sc, setSc] = useState(m.scenarios[d.szenario]?.years?.length ? d.szenario : (ids[0]?.id ?? Object.keys(m.scenarios)[0]));
  const run = m.scenarios[sc];
  const ys = run.years;
  const y0 = ys[0].year;
  const y1 = ys[ys.length - 1].year;
  const clamp = (y: number) => Math.min(y1, Math.max(y0, y));
  const [year, setYear] = useState(() => clamp(d.jahr));
  const Y = ys.find((y) => y.year === year) ?? ys[0];

  const need = Math.round(Y.demand[1]);
  const sup = Math.round(Y.served[1]);
  // Lücke = Differenz der Mediane (so stehen benötigt − gestartet = Lücke untereinander); der Anteil der Läufe mit Lücke kommt aus dem Monte Carlo.
  const gap = need - sup;
  const V = {
    year: Y.year,
    need: nf(need),
    sup: nf(sup),
    gap: nf(gap),
    captive: nf(Y.open ? need - Math.round(Y.open[1]) : NaN),
    p: nf(100 * (Y.p_gap ?? NaN)),
    runs: nf(run.draws),
    n: nf(d.punkt),
  };
  const red = gap > 0;

  // Punktring: ein Punkt je d.punkt Satelliten, im Uhrzeigersinn ab oben; erst gestartet (gefüllt), dann ohne Rakete (hohl).
  const nDots = Math.max(0, Math.round(need / d.punkt));
  const nSup = Math.min(nDots, Math.round(sup / d.punkt));
  const ring = Array.from({ length: nDots }, (_, i) => {
    const a = (i / nDots) * 2 * Math.PI - Math.PI / 2;
    const r = 41 + (i % RINGS) * 3;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a), hollow: i >= nSup };
  });

  // Monte Carlo über die Zeit: Band P10–P90 des Bedarfs, Linien Median benötigt und gestartet (davor GCAT-Historie), Lücke schattiert.
  const C = useMemo(() => {
    const first = Math.min(d.von, y0);
    const hist = (m.history ?? []).filter((h) => h.year >= first && h.year < y0);
    const maxV = Math.max(...ys.map((y) => y.demand[2]), ...hist.map((h) => h.sats)) * 1.05;
    const x = (yr: number) => ((yr - first) / (y1 - first)) * W;
    const y = (v: number) => H - (v / maxV) * H;
    const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("");
    const area = (top: [number, number][], bot: [number, number][]) => `${path(top)}${path([...bot].reverse()).replace("M", "L")}Z`;
    const at = (f: (y: McYear) => number) => ys.map((r) => [r.year, f(r)] as [number, number]);
    const stepV = maxV > 6000 ? 2500 : 1000;
    return {
      first,
      maxV,
      x,
      band: area(at((r) => r.demand[2]), at((r) => r.demand[0])),
      gap: area(at((r) => r.demand[1]), at((r) => r.served[1])),
      need: path(at((r) => r.demand[1])),
      sup: path([...hist.map((h) => [h.year, h.sats] as [number, number]), ...at((r) => r.served[1])]),
      grid: Array.from({ length: Math.floor(maxV / stepV) }, (_, i) => (i + 1) * stepV),
      ticks: [first, 2025, 2030, 2035, 2040, 2045, y1].filter((t, i, a) => t >= first && t <= y1 && a.indexOf(t) === i),
    };
  }, [d.von, m.history, ys, y0, y1]);
  const pct = (yr: number) => `${((yr - C.first) / (y1 - C.first)) * 100}%`;
  const top = (v: number) => `${(1 - v / C.maxV) * 100}%`;
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setYear(clamp(Math.round(C.first + ((e.clientX - b.left) / b.width) * (y1 - C.first))));
  };
  const fan = m.fan_from;
  // Quelle und Methode nur als Tooltip am Diagramm (keine Fußnote auf der Slide).
  const method = fill(T.methode, { runs: nf(run.draws), vehicles: nf(m.vehicles), fan, source: m.source, created: `${run.created_at.slice(0, 16).replace("T", " ")} UTC`, seed: run.seed });

  return (
    <section id="einstieg" aria-labelledby="weltmarkt-titel" className="relative isolate flex min-h-[calc(100svh-var(--header-h))] flex-col gap-4 px-4 pb-4 pt-6 sm:px-12">
      <h2 id="weltmarkt-titel" className="sr-only">
        {fill(red ? T.titel : T.titel_ohne, V)}
      </h2>

      <div className="grid min-h-0 flex-1 items-center gap-6 md:grid-cols-[minmax(300px,440px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setYear(clamp(year - 1))} disabled={year <= y0} aria-label={T.jahr_zurueck} className="h-11 w-11 rounded-full border border-rule-strong text-[18px] text-mist disabled:opacity-40">
              ‹
            </button>
            <span className="min-w-[4ch] text-center font-mono text-[26px] font-medium" aria-live="polite">
              {year}
            </span>
            <button type="button" onClick={() => setYear(clamp(year + 1))} disabled={year >= y1} aria-label={T.jahr_vor} className="h-11 w-11 rounded-full border border-rule-strong text-[18px] text-mist disabled:opacity-40">
              ›
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-ice">{T.needed}</span>
            <span className="text-[clamp(2.6rem,4.8vw,4.6rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ice">{V.need}</span>
            <span className="text-[15px] text-mist">{fill(T.needed_info, V)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-mist">{T.launched}</span>
            <span className="text-[clamp(2.6rem,4.8vw,4.6rem)] font-bold leading-[0.95] tracking-[-0.035em]">{V.sup}</span>
            <span className="text-[15px] text-mist">{fill(T.launched_info, V)}</span>
            <span className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-mist">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-snow" />
                {T.leg_launched}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border-[1.5px] border-red" />
                {T.leg_gap}
              </span>
              <span className="text-mist-2">{fill(T.leg_unit, V)}</span>
            </span>
          </div>
          <div className="flex flex-col gap-1 border-t border-rule-strong pt-4" style={{ color: red ? "var(--color-red)" : "var(--color-aurora)" }}>
            <span className="font-mono text-[13px] uppercase tracking-[0.14em]">{T.gap}</span>
            <span className="text-[clamp(3.2rem,6.4vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.04em]">{red ? `+${V.gap}` : "0"}</span>
            <span className="text-[15px] font-medium">{fill(red ? T.gap_info : T.keine, V)}</span>
          </div>
        </div>

        <div className="relative mx-auto max-md:hidden" style={{ width: "min(calc(100svh - var(--header-h) - 340px), 46vw)", aspectRatio: "1" }}>
          <div className="absolute inset-[10%]">
            <GlobeView home={d.home} />
          </div>
          <span className="sr-only">{T.globus}</span>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {ring.map((p, i) => (
              <span
                key={i}
                className={`absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top,background-color,border-color] duration-300 ${p.hollow ? "border-[1.5px] border-red" : "bg-snow shadow-[0_0_4px_rgba(233,237,242,0.6)]"}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div
          className="relative h-[clamp(110px,16svh,180px)] cursor-pointer touch-none select-none"
          title={method}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => e.buttons && pick(e)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 block h-full w-full overflow-visible">
            {fan <= y1 && <rect x={C.x(fan)} y={0} width={W - C.x(fan)} height={H} fill="var(--color-snow)" fillOpacity={0.03} />}
            {C.grid.map((v) => (
              <line key={v} x1={0} x2={W} y1={H - (v / C.maxV) * H} y2={H - (v / C.maxV) * H} stroke="var(--color-rule)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={H} y2={H} stroke="var(--color-rule-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <path d={C.band} fill="var(--color-ice)" fillOpacity={0.14} />
            <path d={C.gap} fill="var(--color-red)" fillOpacity={0.35} />
            <path d={C.need} fill="none" stroke="var(--color-ice)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <path d={C.sup} fill="none" stroke="var(--color-snow)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <line x1={C.x(year)} x2={C.x(year)} y1={0} y2={H} stroke="var(--color-snow)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="pointer-events-none absolute inset-0 font-mono text-[11px] text-mist-2" aria-hidden="true">
            {C.grid.map((v) => (
              <span key={v} className="absolute left-0 -translate-y-full pb-0.5" style={{ top: top(v) }}>
                {nf(v)}
              </span>
            ))}
            {fan <= y1 && (
              <span className="absolute top-0 pl-1.5" style={{ left: pct(fan) }}>
                {fill(T.fan, { fan })}
              </span>
            )}
            <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ice" style={{ left: pct(year), top: top(Y.demand[1]) }} />
            <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-snow" style={{ left: pct(year), top: top(Y.served[1]) }} />
          </div>
          <label htmlFor="jahr" className="sr-only">
            {T.jahr}
          </label>
          <input id="jahr" type="range" min={y0} max={y1} step={1} value={year} onChange={(e) => setYear(clamp(Number(e.target.value)))} className="sr-only" />
        </div>
        <div className="relative h-[18px] font-mono text-[12px]" aria-hidden="true">
          {C.ticks.map((yr, i, a) => (
            <span
              key={yr}
              className={`absolute ${[2025, 2035, 2045].includes(yr) ? "max-sm:hidden" : ""}`}
              style={{
                left: pct(yr),
                transform: `translateX(${i === 0 ? "0" : i === a.length - 1 ? "-100%" : "-50%"})`,
                color: yr === year ? "var(--color-snow)" : yr >= fan ? "var(--color-amber)" : "var(--color-mist-2)",
              }}
            >
              {yr}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <div role="group" aria-label={T.starship} className="flex items-center gap-2.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-mist">{T.starship}</span>
          <div className="flex border border-rule-strong">
            {ids.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={sc === s.id}
                onClick={() => setSc(s.id)}
                className={`min-h-11 px-3.5 text-[14px] ${sc === s.id ? "bg-ice font-semibold text-night" : "text-snow"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Globus ohne Pins, eigener Zustand fürs Ziehen; fällt WebGL aus, steht der Grund da. */
function GlobeView({ home }: { home: View }) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed ? (
    <p className="absolute inset-0 grid place-items-center text-center text-[15px] text-mist">3D globe not available: {failed}</p>
  ) : (
    <Globe view={home} from={{ ...home, lon: home.lon - 95 }} onFail={setFailed} />
  );
}
