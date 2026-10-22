"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { SitesCompare, Tables } from "@/lib/story";
import type { Pin, PinPos } from "./Globe";
import { nf, num, val } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

const VIEW = { lat: 42, lon: -22, dist: 3.0 };
const STEPS = 24;

/** Großkreis zwischen zwei Punkten, STEPS + 1 Stützstellen (für die Wege Fabrik → Startplatz). */
function arc(a: [number, number], b: [number, number]): [number, number][] {
  const r = Math.PI / 180;
  const v = ([la, lo]: [number, number]) => [Math.cos(la * r) * Math.cos(lo * r), Math.cos(la * r) * Math.sin(lo * r), Math.sin(la * r)];
  const p = v(a);
  const q = v(b);
  const w = Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]));
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const f = i / STEPS;
    const s1 = w ? Math.sin((1 - f) * w) / Math.sin(w) : 1 - f;
    const s2 = w ? Math.sin(f * w) / Math.sin(w) : f;
    const x = s1 * p[0] + s2 * q[0];
    const y = s1 * p[1] + s2 * q[1];
    const z = s1 * p[2] + s2 * q[2];
    return [Math.atan2(z, Math.hypot(x, y)) / r, Math.atan2(y, x) / r];
  });
}

export interface FabrikData {
  fabrik1: { name: string; ort: string; lat: number; lon: number; flaeche: number; jahr: number; zeilen: [string, string][] };
  karte: string;
  fabrik2: { schwelle: number; gebaut_2026: number; kandidaten: [string, string, string, string][]; ausloeser: string; fuss: string };
  frage: string;
  dashboard: {
    formel: string;
    start: Record<string, number>;
    /** [Schlüssel, Label, min, max, Schritt, Einheit als Muster („#“ = Zahl, z. B. „EUR #M“), Hinweis] */
    hebel: [string, string, number, number, number, string, string][];
    szenarien: [string, Record<string, number>][];
  };
}

/** Frage 3 (Artboard 4): Fabrik 1, Wege zu den Startplätzen, Option Fabrik 2, Engpass-Kette und Kapitalallokation. */
export function FabrikBlock({ d, t, sc }: { d: FabrikData; t: Tables; sc: SitesCompare }) {
  const f1 = d.fabrik1;
  const PER_FACTORY = val(t, "portfolio_chain:A_fabrik:value");
  const DEMAND_A = val(t, "portfolio_chain:A_nachfrage:value");
  const DEMAND = val(t, "portfolio_chain:D_nachfrage:value");
  const BREAK_EVEN = val(t, "break_even_ops");
  const PRICE = val(t, "assumptions:price_per_launch_eur_m:value_base");
  const threshold = PER_FACTORY * d.fabrik2.schwelle;

  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const { pinList, routes } = useMemo(() => {
    const home: [number, number] = [f1.lat, f1.lon];
    const routes = sc.sites.map((s) => ({ id: s.id, pts: arc(home, [num(s.lat), num(s.lon)]) }));
    const pinList: Pin[] = [{ id: "fabrik", lat: f1.lat, lon: f1.lon }, ...routes.flatMap((r) => r.pts.map(([lat, lon], i) => ({ id: `${r.id}:${i}`, lat, lon })))];
    return { pinList, routes };
  }, [f1, sc]);

  const db = d.dashboard;
  const [st, setSt] = useState<Record<string, number>>(db.start);
  const need = st.F * PER_FACTORY * (st.U / 100);
  const per = (365 * (st.W / 100)) / st.T;
  const X = Math.ceil(need / per - 1e-9);
  const invest = st.FW > 0 && st.PK > 0 ? st.F * st.FW + X * st.PK : null;
  const kpis = [
    { label: "Launches per year needed", value: nf(need), sub: "for the target utilisation" },
    { label: "Launches per pad and year", value: nf(per, 1), sub: "weather-adjusted" },
    { label: "X = pads needed", value: String(X), sub: "at this turnaround", accent: "#ff8a80" },
    { label: "Utilisation at 2030 demand", value: `${nf((DEMAND / (st.F * PER_FACTORY)) * 100)}%`, sub: `${nf(DEMAND, 1)} winnable missions` },
    { label: "Launches without customers", value: nf(Math.max(0, need - DEMAND), 1), sub: "need minus 2030 demand", accent: need > DEMAND ? "#f2b45a" : undefined },
    { label: "Investment", value: invest === null ? "open" : `EUR ${nf(invest)}M`, sub: "factories plus pads" },
  ];
  const bars = [
    { label: "Factories at target utilisation", v: need, bg: "#4fa3d9" },
    { label: `Capacity of the ${X} pads`, v: X * per, bg: "#7ee0b5" },
    { label: "Winnable demand 2030", v: DEMAND, bg: "#f2b45a" },
    { label: "Break-even operation", v: BREAK_EVEN, bg: "transparent", border: "1.5px dashed #ff8a80" },
  ];
  const max = Math.max(...bars.map((b) => b.v)) * 1.08;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-stretch gap-7 xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)_minmax(0,330px)]">
        <div className="flex flex-col gap-4 border-2 border-rule-strong bg-night-3 p-[22px]">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 flex-none rounded-full bg-red" />
            <div className="flex flex-col">
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-mist">Factory</span>
              <span className="text-[28px] font-semibold leading-[1.15]">
                {f1.name} <span className="text-[16px] font-normal text-mist">{f1.ort}</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat value={nf(f1.flaeche)} label="m² floor space" />
            <Stat value={nf(PER_FACTORY)} label="rockets per year, design" />
            <Stat value={`${nf((DEMAND_A / PER_FACTORY) * 100)}%`} label={`utilisation ${f1.jahr} (${nf(DEMAND_A, 1)} of ${nf(PER_FACTORY)})`} accent />
          </div>
          <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[14px] leading-[1.4]">
            {[...f1.zeilen.slice(0, 2), ["Break-even", `${nf(BREAK_EVEN)} launches per year at EUR ${nf(PRICE)}M launch price (assumption)`], ...f1.zeilen.slice(2)].map(([l, v]) => (
              <span key={l} className="contents">
                <span className="text-mist">{l}</span>
                <span>{v}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="relative aspect-[1120/700] w-full overflow-hidden rounded">
            <Globe view={VIEW} pins={pinList} onPins={setPins} />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {routes.map((r) => {
                const pts = r.pts.map((_, i) => pins[`${r.id}:${i}`]).filter((p) => p?.front);
                const on = r.id === "andoya";
                return (
                  <polyline
                    key={r.id}
                    points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={on ? "#ff5a4f" : "#8fd3ff"}
                    strokeOpacity={on ? 1 : 0.55}
                    strokeWidth={on ? 2.5 : 1.5}
                    strokeDasharray={on ? undefined : "5 5"}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0">
              {pins.fabrik?.front && <Marker x={pins.fabrik.x} y={pins.fabrik.y} label={`${f1.name} factory`} />}
              {sc.sites.map((s) => {
                const p = pins[`${s.id}:${STEPS}`];
                if (!p?.front) return null;
                return s.id === "andoya" ? (
                  <Marker key={s.id} x={p.x} y={p.y} label="Andøya" left />
                ) : (
                  <span key={s.id} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ice" style={{ left: p.x, top: p.y }} />
                );
              })}
            </div>
          </div>
          <span className="text-center text-[14px] text-mist">{d.karte}</span>
        </div>

        <div className="flex flex-col gap-3.5 border-2 border-dashed border-amber bg-night-3 p-[22px]">
          <div className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 flex-none rounded-full border-2 border-red" />
            <div className="flex flex-col">
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-amber">Factory 2 · Option</span>
              <span className="text-[28px] font-semibold leading-[1.15]">Another factory</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat value={nf(threshold)} label={`launches per year at which factory 1 is full (${nf(d.fabrik2.schwelle * 100)}% of ${nf(PER_FACTORY)})`} />
            <Stat value={nf(d.fabrik2.gebaut_2026)} label="rockets built in 2026 (actual)" />
          </div>
          <div className="flex flex-col text-[13px]">
            {[["Candidate", "Talent", "Stability", "Wage/h"], ...d.fabrik2.kandidaten].map((r, i) => (
              <div key={r[0]} className={`grid grid-cols-[minmax(0,1fr)_46px_58px_64px] gap-1.5 py-1.5 ${i === 0 ? "border-b border-rule-strong text-mist" : i < 4 ? "border-b border-rule" : "text-mist"}`}>
                {r.map((c, j) => (
                  <span key={j}>{c}</span>
                ))}
              </div>
            ))}
          </div>
          <span className="text-[14px] leading-[1.45]">
            <b className="font-semibold text-amber">Trigger:</b> demand above {nf(threshold)} launches per year, or {d.fabrik2.ausloeser}
          </span>
          <span className="text-[12px] leading-[1.4] text-mist-2">{d.fabrik2.fuss}</span>
        </div>
      </div>

      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-3.5 text-[19px] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-snow font-bold transition-transform duration-300 group-open:rotate-45">
            +
          </span>
          <span>{d.frage}</span>
        </summary>

      <section aria-labelledby="kap-h" className="mt-6 flex flex-col gap-[18px] border-x-2 border-red bg-red/[0.06] px-[26px] py-[22px]">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-1.5">
            <h3 id="kap-h" className="self-start bg-[linear-gradient(transparent_55%,rgba(255,90,79,0.5)_55%,rgba(255,90,79,0.5)_90%,transparent_90%)] px-1 text-[26px] font-semibold">
              Capital allocation · Dashboard
            </h3>
            <span className="text-[15px] leading-normal text-mist">{db.formel}</span>
          </div>
          <div role="group" aria-label="Scenario" className="flex flex-wrap gap-1">
            {db.szenarien.map(([label, v]) => {
              const on = Object.keys(v).every((k) => st[k] === v[k]);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSt({ ...st, ...v })}
                  aria-pressed={on}
                  className={`min-h-11 border px-3 text-[14px] ${on ? "border-ice bg-ice text-night" : "border-rule-strong bg-night-2 text-snow"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 border border-rule bg-night-2 p-[18px]">
            <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-mist">Levers</span>
            {db.hebel.map(([k, label, min, maxV, step, unit, hint]) => (
              <label key={k} className="flex flex-col gap-1 text-[15px]">
                <span className="flex justify-between gap-2.5">
                  <span>{label}</span>
                  <b className="font-mono text-[15px] font-medium text-ice">{(k === "FW" || k === "PK") && !st[k] ? "open" : unit.replace("#", nf(st[k]))}</b>
                </span>
                <input type="range" min={min} max={maxV} step={step} value={st[k]} onChange={(e) => setSt({ ...st, [k]: Number(e.target.value) })} className="m-0 min-h-7 w-full accent-ice" />
                <span className="text-[12px] text-mist-2">{k === "F" ? `${nf(PER_FACTORY)} rockets per year each, like ${f1.name}` : hint}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {kpis.map((kp) => (
                <div key={kp.label} className="flex flex-col gap-1.5 border bg-night-2 px-4 py-3.5" style={{ borderColor: kp.accent ?? "var(--color-rule)" }}>
                  <span className="text-[13px] text-mist">{kp.label}</span>
                  <span className="text-[38px] font-semibold leading-none" style={{ color: kp.accent ?? "var(--color-snow)" }}>
                    {kp.value}
                  </span>
                  <span className="text-[13px] text-mist-2">{kp.sub}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 border border-rule bg-night-2 px-[18px] py-4">
              <span className="text-[14px] text-mist">Capacity versus demand, launches per year</span>
              {bars.map((b) => (
                <div key={b.label} className="grid grid-cols-[minmax(0,250px)_minmax(0,1fr)_56px] items-center gap-3 text-[14px]">
                  <span>{b.label}</span>
                  <span className="h-3.5 bg-night-3">
                    <span className="block h-full transition-[width] duration-500" style={{ width: `${(100 * b.v) / max}%`, background: b.bg, border: b.border ?? 0, boxSizing: "border-box" }} />
                  </span>
                  <b className="text-right font-mono text-[14px] font-medium">{nf(b.v, 1)}</b>
                </div>
              ))}
            </div>
            <span className="text-[15px] leading-normal text-amber">
              {need > DEMAND
                ? `Cross-check: for ${nf(need)} launches there are only ${nf(DEMAND, 1)} winnable missions in 2030. More factories and pads build capacity without customers.`
                : `Cross-check: capacity covers the winnable demand in 2030. The constraint here is the break-even of ${nf(BREAK_EVEN)} launches.`}
            </span>
          </div>
        </div>
      </section>
      </details>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 border p-2.5 ${accent ? "border-red" : "border-rule-strong"}`}>
      <span className={`text-[24px] font-semibold leading-none ${accent ? "text-alert" : ""}`}>{value}</span>
      <span className="text-[13px] text-mist">{label}</span>
    </div>
  );
}

function Marker({ x, y, label, left }: { x: number; y: number; label: string; left?: boolean }) {
  return (
    <>
      <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red" style={{ left: x, top: y }} />
      <span className="absolute whitespace-nowrap bg-night/80 px-[7px] py-0.5 text-[14px]" style={{ left: x, top: y, transform: left ? "translate(calc(-100% - 12px), -50%)" : "translate(14px, -50%)" }}>
        {label}
      </span>
    </>
  );
}
