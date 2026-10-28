"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { asset } from "@/lib/data";
import { useLiveJSON, type SitesCompare, type Tables } from "@/lib/story";
import type { Pin, PinPos } from "./Globe";
import { nf, num, val } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

const VIEW = { lat: 42, lon: -22, dist: 3.0 };
const STEPS = 24;
const DAYS = 365;

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

/** Szenario-Wert: Zahl oder Verweis auf eine gerechnete Größe („plan“ = Auslastung im Plan 2030, „fast“ = schnelle Wendezeit). */
type Wert = number | "plan" | "fast";

export interface FabrikData {
  /** Lead unter dem Kapiteltitel (story.json); Platzhalter in {} (z. B. {u} Ziel-Auslastung, {out} Raketen pro Jahr). */
  lead: string;
  /** Aktionstitel der Popups (ganzer Satz, kein Doppelpunkt), Platzhalter wie im Lead. */
  titel: { f1: string; f2: string; model: string };
  fabriken: number;
  ziel_auslastung: number;
  wendezeit_schnell: number;
  break_even_info: string;
  /** Welt-Lücke 2030 (fehlende Starts). Sind datei und feld gesetzt (z. B. „data/flow.json“, „weltmarkt.luecke_2030“), gilt der Wert dort; sonst wert als sichtbarer Platzhalter. */
  luecke_2030: {
    label: string;
    wert: number;
    platzhalter: boolean;
    datei: string | null;
    feld: string | null;
    hinweis: string;
    /** Monte Carlo (Seite 2): Jahr und Szenario der Satelliten-Lücke; Quelle data/demand/global_demand_mc.json. */
    jahr?: number;
    szenario?: string;
    mc_label?: string;
    mc_hinweis?: string;
  };
  fabrik1: { name: string; ort: string; land: string; lat: number; lon: number; zeilen: [string, string][]; fazit: string };
  karte: string;
  fabrik2: { ort: string; schwelle: number; kandidaten: [string, string, string, string][]; ausloeser: string; fuss: string };
  fuss: string;
  modell: {
    formel: string;
    /** [Schlüssel, Label, min, max, Schritt, Einheit als Muster („#“ = Zahl, z. B. „EUR #M“), Hinweis] */
    hebel: [string, string, number, number, number, string, string][];
    szenarien: [string, Record<string, Wert>][];
    check_hoch: string;
    check_tief: string;
  };
}

const fill = (s: string | undefined, v: Record<string, string>) => (s ?? "").replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);
const pct = (share: number) => `${nf(share * 100)}%`;

/** Ausschnitt aus data/demand/global_demand_mc.json (Supabase demand_mc), Werte je Jahr [P10, P50, P90]. */
type McFile = { demand_mc?: { scenarios?: Record<string, { years?: { year: number; demand: number[]; served: number[] }[] }> } };
/** Rampen, um need Starts pro Jahr zu fliegen; je Rampe 365 × Wetteranteil / Wendezeit Starts. */
const padsFor = (need: number, turn: number, weather: number) => Math.ceil(need / ((DAYS * weather) / turn) - 1e-9);

/** Welt-Lücke 2030 aus einer anderen Datei, sobald luecke_2030.datei und .feld gesetzt sind; sonst undefined. */
function useGap(g: FabrikData["luecke_2030"]) {
  const [v, setV] = useState<number>();
  useEffect(() => {
    const { datei, feld } = g;
    if (!datei || !feld) return;
    let alive = true;
    fetch(asset(datei), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const x = feld.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), j);
        if (alive && typeof x === "number" && Number.isFinite(x)) setV(x);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [g]);
  return v;
}

type Pop = "f1" | "f2" | "model";

/** Frage 3 (Executive-Fassung): zwei Fabriken bei Ziel-Auslastung gegen die Welt-Lücke 2030; Details nur als Popup. */
export function FabrikBlock(p: { d: FabrikData; t: Tables; sc: SitesCompare }) {
  // Datenform prüfen, bevor tief zugegriffen wird: eine ältere flow.json zeigt einen Hinweis statt die Seite abstürzen zu lassen.
  const d = p.d as Partial<FabrikData> | undefined;
  const ok = d?.luecke_2030 && d.titel && d.fabrik1?.zeilen && d.fabrik2?.kandidaten && d.modell?.hebel && d.modell.szenarien && p.sc?.sites;
  if (!ok) return <p className="border border-dashed border-amber px-4 py-3 text-[15px] text-mist">The factory chapter is waiting for flow.json[&quot;fabrik&quot;] in the current shape.</p>;
  return <FabrikView {...p} />;
}

function FabrikView({ d, t, sc }: { d: FabrikData; t: Tables; sc: SitesCompare }) {
  const f1 = d.fabrik1;
  const CAP = val(t, "portfolio_chain:A_fabrik:value");
  const PLAN = val(t, "portfolio_chain:A_nachfrage:value");
  const WIN = val(t, "portfolio_chain:D_nachfrage:value");
  const BE = val(t, "break_even_ops");
  const TURN = val(t, "assumptions:turnaround_days_pad:value_base");
  const WEATHER = val(t, "assumptions:weather_availability_andoya:value_base");
  const U = d.ziel_auslastung;
  const per = CAP * U;
  const out = d.fabriken * per;
  const planU = Math.round((100 * PLAN) / CAP);
  const ext = useGap(d.luecke_2030);
  // Welt-Lücke aus dem Monte Carlo (Seite 2): Satelliten ohne Rakete = Bedarf P50 minus geflogen P50 im gewählten Szenario.
  const mc = useLiveJSON<McFile>("data/demand/global_demand_mc.json");
  const L = d.luecke_2030;
  const mcRow = mc.state === "ready" ? mc.data.demand_mc?.scenarios?.[L.szenario ?? ""]?.years?.find((y) => y.year === L.jahr) : undefined;
  const gapSats = mcRow ? mcRow.demand[1] - mcRow.served[1] : undefined;
  // Satelliten je Spectrum-Start = Nutzlast LEO / mittlere Kleinsatelliten-Masse 2025 (beides Case-DB).
  const SPL = val(t, "launch_vehicles:spectrum:payload_leo_kg") / val(t, "market_metrics:mm_036:value");
  const sats = gapSats !== undefined && Number.isFinite(SPL);
  const k = sats ? SPL : 1; // Raketen → Lückeneinheit
  const gap = sats ? gapSats : ext ?? L.wert;
  const placeholder = !sats && ext === undefined && L.platzhalter;
  const gapLabel = sats ? L.mc_label ?? L.label : L.label;
  const unit = sats ? "satellites" : "launches";
  const v: Record<string, string> = {
    u: pct(U),
    out: nf(out),
    per: nf(per),
    cap: nf(CAP),
    name: f1.name,
    plan: `${nf(planU)}%`,
    fast: nf(d.wendezeit_schnell),
    win: nf(WIN, 1),
    be: nf(BE),
    price: nf(val(t, "assumptions:price_per_launch_eur_m:value_base")),
    unit: nf(val(t, "assumptions:variable_cost_unit20_eur_m:value_base")),
    fix: nf(val(t, "assumptions:fixed_cost_eur_m:value_base")),
    lr: nf(val(t, "assumptions:learning_rate:value_base"), 2),
    built: nf(val(t, "assumptions:factory_actual_rate_2026:value_base")),
    x: nf(per / PLAN, 1),
    thr: nf(CAP * d.fabrik2.schwelle),
    wa: pct(WEATHER),
    wn: pct(val(t, "assumptions:weather_availability_nova_scotia:value_base")),
    wk: pct(val(t, "assumptions:weather_availability_kourou_elm:value_base")),
  };

  const [pop, setPop] = useState<Pop | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  // Vor den Effekten der Kinder öffnen: der Globus im Popup misst sonst eine leere Fläche.
  useLayoutEffect(() => {
    if (pop && !dlg.current?.open) dlg.current?.showModal();
  }, [pop]);


  // Ausgabemodell: Basis aus den Daten, Szenarien überschreiben einzelne Hebel.
  const m = d.modell;
  const base = { F: d.fabriken, U: U * 100, T: TURN, W: WEATHER * 100 };
  const [st, setSt] = useState<Record<string, number>>({ ...base, FW: 0, PK: 0 });
  const preset = (o: Record<string, Wert>) => ({ ...base, ...Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x === "plan" ? planU : x === "fast" ? d.wendezeit_schnell : x])) });
  const need = st.F * CAP * (st.U / 100);
  const perPad = (DAYS * (st.W / 100)) / st.T;
  const X = padsFor(need, st.T, st.W / 100);
  const invest = st.FW > 0 && st.PK > 0 ? st.F * st.FW + X * st.PK : null;
  const share = `${nf((100 * need * k) / gap)}%`;
  const gapNote = `${nf(gap)} ${unit} missing${placeholder ? " (placeholder)" : ""}`;
  const kpis = [
    { label: "Rockets a year", value: nf(need), sub: `${nf(st.F)} ${st.F === 1 ? "factory" : "factories"} at ${nf(st.U)}%` },
    { label: "Launches per pad and year", value: nf(perPad, 1), sub: "weather-adjusted" },
    { label: "Pads needed", value: nf(X), sub: `at a ${nf(st.T)}-day turnaround`, accent: "var(--color-ice)" },
    { label: "Share of the world gap 2030", value: share, sub: gapNote, accent: "var(--color-alert)" },
    { label: "Above what Isar can win today", value: nf(Math.max(0, need - WIN), 1), sub: `${v.win} winnable missions in 2030 (case DB)`, accent: need > WIN ? "var(--color-amber)" : undefined },
    { label: "Investment", value: invest === null ? "n/a" : `EUR ${nf(invest)}M`, sub: "factories plus pads" },
  ];
  const bars = [
    { label: "Rockets built at this utilisation", v: need, bg: "var(--color-ice-deep)" },
    { label: `Capacity of the ${nf(X)} pads`, v: X * perPad, bg: "var(--color-aurora)" },
    { label: sats ? "World gap 2030 in Spectrum launches" : `World gap 2030${placeholder ? " (placeholder)" : ""}`, v: gap / k, bg: "var(--color-red)" },
    { label: "Winnable for Isar 2030 (case DB)", v: WIN, bg: "var(--color-amber)" },
    { label: "Break-even", v: BE, bg: "transparent", border: "1.5px dashed var(--color-alert)" },
  ];
  const max = Math.max(...bars.map((b) => b.v)) * 1.08;

  const facts: [string, string, boolean?][] = [
    [nf(val(t, "facts:fa_fs01_043:value_num")), "m² floor space"],
    [v.cap, "rockets a year, design"],
    [v.plan, `utilisation in the 2030 plan (${nf(PLAN, 1)} of ${v.cap})`, true],
  ];

  const bodies: Record<Pop, { kicker: string; tone: string; title: ReactNode; wide: boolean; body: ReactNode }> = {
    f1: {
      kicker: `Factory 1 · built · ${f1.name}, ${f1.ort}, ${f1.land}`,
      tone: "text-mist",
      title: fill(d.titel.f1, v),
      wide: true,
      body: (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2.5">
              {facts.map(([value, label, accent]) => (
                <Stat key={label} value={value} label={label} accent={accent ? "var(--color-red)" : undefined} />
              ))}
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[15px] leading-[1.4]">
              {f1.zeilen.map(([l, s]) => (
                <span key={l} className="contents">
                  <span className="text-mist">{l}</span>
                  <span>{fill(s, v)}</span>
                </span>
              ))}
            </div>
            <p className="border-l-[3px] border-red pl-3 text-[15px] leading-[1.45]">{fill(f1.fazit, v)}</p>
          </div>
          <div className="flex flex-col gap-2">
            <RoutesGlobe f1={f1} sc={sc} />
            <span className="text-[13px] text-mist">{d.karte}</span>
          </div>
        </div>
      ),
    },
    f2: {
      kicker: "Factory 2 · option · site to be decided",
      tone: "text-amber",
      title: fill(d.titel.f2, v),
      wide: false,
      body: (
        <>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Stat value={v.cap} label="rockets a year, same design as factory 1 (assumption)" />
            <Stat value={nf(CAP * d.fabrik2.schwelle)} label={`launches a year at which factory 1 is full (${pct(d.fabrik2.schwelle)} of ${v.cap})`} accent="var(--color-amber)" />
            <Stat value={v.built} label="rockets built in 2026 (actual)" />
          </div>
          <div role="table" aria-label="Candidates for factory 2" className="flex flex-col text-[15px]">
            {[["Candidate", "Talent", "Stability", "Wage per hour"], ...d.fabrik2.kandidaten].map((r, i, all) => (
              <div
                key={r[0]}
                role="row"
                className={`grid grid-cols-[minmax(0,1fr)_56px_72px_96px] gap-2.5 sm:grid-cols-[minmax(0,1fr)_90px_100px_110px] ${
                  i === 0 ? "border-b border-rule-strong py-1.5 text-[13px] text-mist" : i < all.length - 1 ? "border-b border-rule py-2" : "py-2 text-mist"
                }`}
              >
                {r.map((c, j) => (
                  <span key={j} role={i === 0 ? "columnheader" : "cell"}>
                    {c}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[15px] leading-[1.45]">
            <b className="font-semibold text-amber">Trigger:</b> demand above {nf(CAP * d.fabrik2.schwelle)} launches a year, or {d.fabrik2.ausloeser}
          </p>
          <p className="text-[12px] leading-[1.4] text-mist-2">{d.fabrik2.fuss}</p>
        </>
      ),
    },
    model: {
      kicker: "Output model",
      tone: "text-mist",
      title: fill(d.titel.model, { ...v, need: nf(need), pads: nf(X), pct: share }),
      wide: true,
      body: (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[70ch] text-[14px] leading-[1.45] text-mist">{m.formel}</p>
            <div role="group" aria-label="Scenario" className="flex flex-wrap gap-1">
              {m.szenarien.map(([label, o]) => {
                const p = preset(o);
                const on = Object.entries(p).every(([k, x]) => st[k] === x);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSt({ ...st, ...p })}
                    aria-pressed={on}
                    className={`min-h-11 border px-3 text-[14px] ${on ? "border-ice bg-ice text-night" : "border-rule-strong bg-night-2 text-snow hover:border-ice"}`}
                  >
                    {fill(label, v)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 border border-rule bg-night p-4">
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-mist">Levers</span>
              {m.hebel.map(([k, label, min, maxV, step, unit, hint]) => (
                <label key={k} className="flex flex-col gap-1 text-[14px]">
                  <span className="flex justify-between gap-2.5">
                    <span>{label}</span>
                    <b className="font-mono text-[14px] font-medium text-ice">{(k === "FW" || k === "PK") && !st[k] ? "n/a" : unit.replace("#", nf(st[k]))}</b>
                  </span>
                  <input type="range" min={min} max={maxV} step={step} value={st[k]} onChange={(e) => setSt({ ...st, [k]: Number(e.target.value) })} className="m-0 min-h-7 w-full accent-ice" />
                  <span className="text-[12px] text-mist-2">{fill(hint, v)}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {kpis.map((kp) => (
                  <div key={kp.label} className="flex flex-col gap-1 border bg-night px-3.5 py-3" style={{ borderColor: kp.accent ?? "var(--color-rule)" }}>
                    <span className="text-[13px] text-mist">{kp.label}</span>
                    <span className="text-[32px] font-semibold leading-none" style={{ color: kp.accent ?? "var(--color-snow)" }}>
                      {kp.value}
                    </span>
                    <span className="text-[12px] text-mist-2">{kp.sub}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border border-rule bg-night px-4 py-3.5">
                <span className="text-[14px] text-mist">Rockets built, pads, gap and break-even · launches per year</span>
                {bars.map((b) => (
                  <div key={b.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[14px] sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)_3.5rem]">
                    <span>{b.label}</span>
                    <span className="h-3.5 bg-night-3">
                      <span className="block h-full transition-[width] duration-500" style={{ width: `${(100 * b.v) / max}%`, background: b.bg, border: b.border ?? 0, boxSizing: "border-box" }} />
                    </span>
                    <b className="text-right font-mono text-[14px] font-medium">{nf(b.v, 1)}</b>
                  </div>
                ))}
              </div>
              <p className="text-[14px] leading-normal text-amber">{fill(need > WIN ? m.check_hoch : m.check_tief, { ...v, need: nf(need), pct: share })}</p>
            </div>
          </div>
        </>
      ),
    },
  };
  const cur = pop ? bodies[pop] : null;

  return (
    <div id="fabrik-block" className="flex flex-col gap-7">
      {d.lead && <p className="max-w-[72ch] text-[17px] leading-[1.45] text-mist">{fill(d.lead, v)}</p>}

      <div className="grid items-stretch gap-7 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,360px)]">
        <FactoryCard
          onOpen={() => setPop("f1")}
          kicker={`Factory 1 · built · ${f1.land}`}
          title={f1.name}
          sub={`${f1.ort} · ${facts[0][0]} m²`}
          cap={v.cap}
          capLabel="design capacity"
          at={`${v.per} a year at ${v.u} utilisation`}
          more="Details"
          border="border-2 border-red"
          tone="text-mist"
          link="text-ice decoration-ice"
        />

        <div className="flex flex-col items-center justify-center gap-4 border-rule px-5 py-2.5 text-center xl:border-x">
          <RoutesGlobe f1={f1} sc={sc} className="max-w-[460px]" />
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-mist">Combined output at {v.u} utilisation</span>
          <span className="flex items-baseline gap-3.5">
            <span className="text-[clamp(88px,9vw,132px)] font-bold leading-[0.9] tracking-[-0.04em]">{v.out}</span>
            <span className="max-w-[150px] text-left text-[22px] font-semibold leading-[1.2]">
              rockets
              <br />a year
            </span>
          </span>
        </div>

        <FactoryCard
          onOpen={() => setPop("f2")}
          kicker="Factory 2 · option · site to be decided"
          title="Second factory"
          sub={d.fabrik2.ort}
          cap={v.cap}
          capLabel="same design (assumption)"
          at={`${v.per} a year at ${v.u} utilisation`}
          more="Candidates"
          border="border-2 border-dashed border-amber"
          tone="text-amber"
          link="text-amber decoration-amber"
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_250px]">
        <Kpi value={v.u} label="target utilisation per factory" sub={`the 2030 plan runs factory 1 at ${v.plan}`} />
        <Kpi value={`${nf(padsFor(out, TURN, WEATHER))} pads`} label={`to fly ${v.out} rockets at a ${nf(TURN)}-day turnaround`} sub={`${nf(padsFor(out, d.wendezeit_schnell, WEATHER))} pads at ${v.fast} days, weather-adjusted`} />
        <Kpi value={v.be} label="launches a year to break even" sub={fill(d.break_even_info, v)} />
        <button
          type="button"
          onClick={() => setPop("model")}
          className="flex min-h-11 flex-col items-start justify-center gap-1 border border-ice bg-night-2 px-[18px] py-3.5 text-left text-[16px] font-semibold text-ice transition-colors hover:bg-night-3"
        >
          <span>Open the output model ›</span>
          <span className="text-[13px] font-normal text-mist">factories, utilisation, turnaround, investment</span>
        </button>
      </div>

      <p className="text-[12px] leading-[1.4] text-mist-2">
        {d.fuss} {placeholder ? L.hinweis : sats ? L.mc_hinweis : null}
      </p>

      <dialog
        ref={dlg}
        aria-labelledby="fabrik-dlg-h"
        onClose={() => setPop(null)}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className={`m-auto max-h-[calc(100dvh-2rem)] max-w-none overflow-auto border border-rule-strong bg-night-2 p-0 text-snow opacity-100 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] backdrop:bg-[#070c16]/90 starting:open:translate-y-3.5 starting:open:opacity-0 ${
          cur?.wide === false ? "w-[min(960px,calc(100vw-2rem))]" : "w-[min(1240px,calc(100vw-2rem))]"
        }`}
      >
        {cur && (
          <div className="flex flex-col gap-5 px-5 py-6 sm:px-[30px]">
            <div className="flex items-start gap-4">
              <div className="flex flex-1 flex-col gap-1">
                <span className={`font-mono text-[12px] uppercase tracking-[0.12em] ${cur.tone}`}>{cur.kicker}</span>
                <h3 id="fabrik-dlg-h" className="text-[clamp(1.4rem,2.2vw,1.9rem)] font-semibold leading-[1.12]">
                  {cur.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => dlg.current?.close()}
                aria-label="Close"
                className="grid h-11 w-11 flex-none place-items-center border border-rule-strong text-[22px] leading-none text-snow transition-colors hover:border-snow"
              >
                ×
              </button>
            </div>
            {cur.body}
          </div>
        )}
      </dialog>
    </div>
  );
}

function FactoryCard(p: { onOpen: () => void; kicker: string; title: string; sub: string; cap: string; capLabel: string; at: string; more: string; border: string; tone: string; link: string }) {
  return (
    <button type="button" onClick={p.onOpen} aria-haspopup="dialog" className={`flex flex-col gap-3.5 bg-night-2 p-[26px] text-left text-snow transition-colors hover:bg-night-3 ${p.border}`}>
      <span className={`font-mono text-[12px] uppercase tracking-[0.12em] ${p.tone}`}>{p.kicker}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[30px] font-semibold leading-[1.1]">{p.title}</span>
        <span className="text-[15px] text-mist">{p.sub}</span>
      </span>
      <span className="flex items-baseline gap-2.5">
        <span className="text-[64px] font-bold leading-none tracking-[-0.03em]">{p.cap}</span>
        <span className="text-[15px] leading-[1.3] text-mist">
          rockets a year,
          <br />
          {p.capLabel}
        </span>
      </span>
      <span className="font-mono text-[15px] font-medium text-ice">{p.at}</span>
      <span className={`mt-auto text-[14px] underline decoration-dotted underline-offset-4 ${p.link}`}>{p.more} ›</span>
    </button>
  );
}

function Kpi({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 border border-rule-strong px-[18px] py-3.5">
      <span className="text-[30px] font-semibold leading-none">{value}</span>
      <span className="text-[14px]">{label}</span>
      <span className="text-[13px] text-mist-2">{sub}</span>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 border border-rule-strong p-3" style={accent ? { borderColor: accent } : undefined}>
      <span className="text-[26px] font-semibold leading-none" style={accent ? { color: accent === "var(--color-red)" ? "var(--color-alert)" : accent } : undefined}>
        {value}
      </span>
      <span className="text-[13px] text-mist">{label}</span>
    </div>
  );
}

/** Globus mit den Wegen von Fabrik 1 zu den sechs Startplätzen (Andøya rot); eigener Pin-Zustand je Instanz. */
function RoutesGlobe({ f1, sc, className = "" }: { f1: FabrikData["fabrik1"]; sc: SitesCompare; className?: string }) {
  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const { pinList, routes } = useMemo(() => {
    const home: [number, number] = [f1.lat, f1.lon];
    const routes = sc.sites.map((s) => ({ id: s.id, pts: arc(home, [num(s.lat), num(s.lon)]) }));
    const pinList: Pin[] = [{ id: "fabrik", lat: f1.lat, lon: f1.lon }, ...routes.flatMap((r) => r.pts.map(([lat, lon], i) => ({ id: `${r.id}:${i}`, lat, lon })))];
    return { pinList, routes };
  }, [f1, sc]);
  return (
    <div className={`relative aspect-[1120/700] w-full overflow-hidden rounded ${className}`}>
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
              stroke={on ? "var(--color-red)" : "var(--color-ice)"}
              strokeOpacity={on ? 1 : 0.55}
              strokeWidth={on ? 2.5 : 1.5}
              strokeDasharray={on ? undefined : "5 5"}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {pins.fabrik?.front && <Marker x={pins.fabrik.x} y={pins.fabrik.y} label="Factory 1" />}
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
