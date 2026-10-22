"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Tables } from "@/lib/story";
import type { Pin, PinPos, View } from "./Globe";
import { nf, num, Rocket, val } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

interface Jahr {
  jahr: number;
  starts?: number;
  ref?: string;
  tonnen: number;
  label: string;
  monate: (number | null)[] | null;
  bahnen: [number, number, number, number];
  isar: string;
}

type Modus = "potential" | "actual";

export interface Weltmarkt {
  home: View;
  jahr: number;
  bis: number;
  /** Ab so vielen gewinnbaren Starts pro Jahr steht eine Rakete für mehrere Starts. */
  raketen_max: number;
  /** Platzhalter {name} werden aus den Daten gefüllt (gruendung, ab, annahme_ab, bis, grenze, grenze_jahr, wachstum, n, unit). */
  texte: Record<
    | "titel"
    | "kicker"
    | "lead"
    | Modus
    | "vor_start"
    | "vor_start_info"
    | "luecke"
    | "luecke_info"
    | "luecke_voll"
    | "reicht"
    | "reicht_info"
    | "annahme"
    | "rk_vor_start"
    | "rk_potential"
    | "rk_actual"
    | "rk_einheit"
    | "zeitleiste"
    | "zeitleiste_info"
    | "panel"
    | "filter"
    | "filter_info"
    | "orte_quelle"
    | "fussnote",
    string
  >;
  jahre: Jahr[];
  zukunft: { jahr: number; starts: number; label: string; isar: string }[];
  zukunft_isar: [number, string][];
  /** wachstum_ref: Verweis auf die Wachstumsrate der Nachfrage ab dem Ende der Engine-Reihe. */
  luecke: { ab: number; nachfrage: number[]; angebot: number[]; wachstum_ref: string; grenze_jahr: number; status: string };
  europa: { ref: string; isar: number; text: string };
  ohne: string[];
  isar_ab: Record<string, number>;
  kandidaten: string[];
  orte: { alle: [string, number][]; isar: [string, number][] };
  pads: [number, number, number, string, string][];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Raketen-Fächer je Startort (Grad), wie im Mockup: 7° pro Rakete, höchstens ±70°.
const FAN_STEP = 7;
const FAN_MAX = 70;
/** Höchstens eine Nachkommastelle, ganze Zahlen ohne (8.6, 10, 40). */
const n1 = (v: number) => nf(v, Math.round(v * 10) % 10 ? 1 : 0);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

/** Einstieg „World market“ (Design-Canvas Skizze Flow, Artboard 1): gewinnbare Starts gegen Isar-Starts, Zeitleiste bis 2049, Globus mit Startorten. */
export function WeltmarktHero({ d, t }: { d: Weltmarkt; t: Tables }) {
  const [year, setYear] = useState(d.jahr);
  const [mode, setMode] = useState<Modus>("potential");
  const [panel, setPanel] = useState(false);
  const [isar, setIsar] = useState(false);
  const [view, setView] = useState<View>(d.home);
  const [pos, setPos] = useState<View>(d.home);
  const [touched, setTouched] = useState(false);
  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const T = d.texte;

  // Lücke = gewinnbare Nachfrage minus Isar-Starts; nach der Engine-Reihe Wachstum, Angebot linear bis zur Fabrikgrenze.
  const grenze = val(t, "portfolio_chain:A_fabrik:value");
  const wachstum = val(t, d.luecke.wachstum_ref);
  const L = d.luecke;
  const n30 = L.nachfrage.length - 1;
  const annahmeAb = L.ab + n30;
  const dem = (yr: number) => (yr < annahmeAb ? L.nachfrage[yr - L.ab] : L.nachfrage[n30] * Math.pow(1 + wachstum, yr - annahmeAb));
  const sup = (yr: number) => {
    if (yr <= annahmeAb) return L.angebot[yr - L.ab];
    return yr >= L.grenze_jahr ? grenze : L.angebot[n30] + ((grenze - L.angebot[n30]) * (yr - annahmeAb)) / (L.grenze_jahr - annahmeAb);
  };
  const first = d.jahre[0].jahr;
  const vars = { gruendung: String(first), ab: String(L.ab), annahme_ab: String(annahmeAb), bis: String(d.bis), grenze: nf(grenze), grenze_jahr: String(L.grenze_jahr), wachstum: nf(100 * wachstum) };

  // Jahr: Ist (jahre), Trend (zukunft, Bahnen wie im Startjahr), danach Prognose ohne Weltzahlen.
  const last = d.jahre[d.jahre.length - 1].jahr;
  const base = d.jahre.find((y) => y.jahr === d.jahr) ?? d.jahre[0];
  const ist = d.jahre.find((y) => y.jahr === year);
  const trend = d.zukunft.find((z) => z.jahr === year);
  const starts = ist ? (ist.ref ? val(t, ist.ref) : ist.starts ?? NaN) : trend?.starts ?? NaN;
  const Y = {
    label: ist?.label ?? trend?.label ?? `${year} (forecast)`,
    tonnen: ist?.tonnen ?? null,
    monate: ist?.monate ?? null,
    bahnen: ist?.bahnen ?? base.bahnen,
    isar: fill(ist?.isar ?? trend?.isar ?? (d.zukunft_isar.find(([bis]) => year <= bis) ?? d.zukunft_isar[d.zukunft_isar.length - 1])[1], vars),
  };
  const maxMonth = useMemo(() => Math.max(...d.jahre.flatMap((y) => (y.monate ?? []).map((m) => m ?? 0))), [d]);

  const dVal = year < L.ab ? 0 : dem(year);
  const sVal = year < L.ab ? 0 : sup(year);
  const gap = year < L.ab ? null : { d: dVal, s: sVal, g: dVal - sVal, mx: Math.max(dVal, sVal) };
  const est = year >= annahmeAb ? T.annahme : "";
  const gapColor = !gap ? "var(--color-mist-2)" : gap.g > 0.05 ? "var(--color-red)" : "var(--color-aurora)";
  const tl = Array.from({ length: d.bis - first + 1 }, (_, i) => {
    const yr = first + i;
    const g = yr < L.ab ? 0 : dem(yr) - sup(yr);
    return { yr, h: Math.min(21, (Math.abs(g) / 10) * 21), up: g > 0 };
  });
  const span = d.bis - first;

  const sites = useMemo(
    () =>
      d.kandidaten.flatMap((id) => {
        const r = t.launch_sites?.find((x) => x.id === id);
        return r && r.lat !== "" ? [{ id: `k:${id}`, key: id, name: String(r.name), lat: num(r.lat), lon: num(r.lon) }] : [];
      }),
    [d, t],
  );
  const pinList = useMemo<Pin[]>(() => [...d.pads.map((p, i) => ({ id: `p${i}`, lat: p[0], lon: p[1] })), ...sites], [d, sites]);

  const dLon = Math.abs(((((pos.lon - d.home.lon) % 360) + 540) % 360) - 180);
  const away = dLon > 6 || Math.abs(pos.lat - d.home.lat) > 6;
  const go = (v: View) => {
    setView(v);
    setPos(v);
    setTouched(true);
  };
  const turn = (deg: number) => go({ ...pos, lon: pos.lon + deg });
  const off = (cc: string) => isar && d.ohne.includes(cc);

  // Raketen nur an Isar-Plätzen ab ihrem ersten Startjahr: Potential = gewinnbare Starts, Actual = Isar-Starts.
  // Je Rakete ein Start; ab raketen_max Starts steht eine Rakete für `unit` Starts (gleich in beiden Modi).
  const unit = Math.max(1, Math.ceil(dVal / d.raketen_max));
  const count = Math.round((mode === "potential" ? dVal : sVal) / unit);
  const act = sites.filter((s) => year >= (d.isar_ab[s.key] ?? Infinity) && pins[s.id]?.front);
  const per = act.length ? Math.ceil(count / act.length) : 0;
  const fan = Math.min(FAN_MAX, per * FAN_STEP);
  const rockets = act.length
    ? Array.from({ length: count }, (_, i) => {
        const s = act[i % act.length];
        const k = Math.floor(i / act.length);
        return { key: `${s.id}:${i}`, p: pins[s.id], ang: per > 1 ? -fan + (2 * fan * k) / (per - 1) : 0, delay: `${((i * 0.17) % 4).toFixed(2)}s` };
      })
    : [];
  const rkColor = mode === "actual" ? "var(--color-red)" : "var(--color-ice)";
  const rkLabel = year < L.ab ? T.rk_vor_start : fill(T[`rk_${mode}`], { n: n1(mode === "actual" ? sVal : dVal) }) + (unit > 1 ? fill(T.rk_einheit, { unit: nf(unit) }) : "");

  return (
    <section
      id="einstieg"
      aria-labelledby="weltmarkt-titel"
      className="relative isolate h-[calc(100svh-var(--header-h))] min-h-[680px] overflow-hidden bg-[radial-gradient(110%_90%_at_50%_45%,#13203a_0%,#0b1220_55%,#070c16_100%)]"
    >
      <div className="absolute inset-y-0 left-4 z-[2] flex w-[min(370px,calc(100%-2rem))] flex-col justify-center gap-[30px] sm:left-12">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-ice">{T.kicker}</span>
          <h2 id="weltmarkt-titel" className="text-[40px] font-semibold leading-[1.08] tracking-[-0.02em]">
            {T.titel}: {year}
          </h2>
          <div role="group" aria-label="View" className="mt-2.5 flex gap-1">
            {(["potential", "actual"] as const).map((k) => {
              const on = mode === k;
              const c = k === "actual" ? "border-red bg-red" : "border-ice bg-ice";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  aria-pressed={on}
                  className={`min-h-11 border px-3.5 text-[15px] font-semibold ${on ? `${c} text-night` : "border-rule-strong bg-night-2 text-snow"}`}
                >
                  {T[k]}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[15px] leading-[1.45] text-mist">{T.lead}</p>
        </div>

        <button type="button" onClick={() => setPanel(true)} aria-label={`Open details on the ${year} gap`} className="flex flex-col gap-2.5 text-left">
          <span className="flex items-baseline gap-3.5" style={{ color: gapColor }} title={gap ? L.status : undefined}>
            <span className="text-[96px] font-bold leading-[0.9] tracking-[-0.03em]">{gap ? n1(Math.abs(gap.g)) : "–"}</span>
            <span className="text-[22px] font-semibold leading-[1.15]">{!gap ? T.vor_start : gap.g > 0.05 ? T.luecke + est : T.reicht + est}</span>
          </span>
          <span className="text-[15px] leading-[1.4] text-mist">
            {fill(!gap ? T.vor_start_info : gap.g <= 0.05 ? T.reicht_info : year >= L.grenze_jahr ? T.luecke_voll : T.luecke_info, vars)}
          </span>
          {gap && (
            <>
              <span className="grid w-full grid-cols-[78px_minmax(0,1fr)_44px] items-center gap-x-2.5 gap-y-1.5 text-[14px]">
                <span className="text-mist">Demand</span>
                <span className="h-3 bg-night-3">
                  <span className="block h-full border-[1.5px] border-ice" style={{ width: `${(100 * gap.d) / gap.mx}%` }} />
                </span>
                <b className="font-mono text-[14px] font-medium">{n1(gap.d)}</b>
                <span className="text-mist">Supply</span>
                <span className="h-3 bg-night-3">
                  <span className="block h-full bg-red" style={{ width: `${(100 * gap.s) / gap.mx}%` }} />
                </span>
                <b className="font-mono text-[14px] font-medium">{n1(gap.s)}</b>
              </span>
              <span className="flex gap-[18px] font-mono text-[14px] font-medium">
                <span className="text-ice">{nf(Math.min(100, (100 * gap.s) / gap.d))} % covered</span>
                <span className="text-alert">{nf(Math.max(0, (100 * gap.g) / gap.d))} % gap</span>
              </span>
            </>
          )}
          <span className="self-start border-b border-dotted border-ice text-[14px] text-ice">View details</span>
        </button>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="jahr" className="text-[14px] text-mist">
            {fill(T.zeitleiste, vars)}
          </label>
          <div aria-hidden="true" className="flex h-11 gap-px">
            {tl.map((b) => (
              <span key={b.yr} className="flex flex-1 flex-col" style={{ opacity: b.yr === year ? 1 : 0.4 }}>
                <span className="flex flex-1 items-end">
                  <span className="w-full bg-red" style={{ height: b.up ? b.h : 0 }} />
                </span>
                <span className="h-px" style={{ background: b.yr === year ? "var(--color-snow)" : "var(--color-rule-strong)" }} />
                <span className="flex flex-1 items-start">
                  <span className="w-full bg-aurora" style={{ height: b.up ? 0 : b.h }} />
                </span>
              </span>
            ))}
          </div>
          <input id="jahr" type="range" min={first} max={d.bis} step={1} value={year} onChange={(e) => setYear(Number(e.target.value))} className="m-0 min-h-11 w-full accent-ice" />
          <div className="relative h-4 font-mono text-[12px]" aria-hidden="true">
            {[first, L.ab, annahmeAb, L.grenze_jahr, d.bis].map((yr, i, a) => (
              <span
                key={yr}
                className="absolute"
                style={{ left: `${((yr - first) / span) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === a.length - 1 ? "-100%" : "-50%"})`, color: yr >= annahmeAb ? "var(--color-amber)" : "var(--color-mist-2)" }}
              >
                {yr}
              </span>
            ))}
          </div>
          <span className="text-[12px] leading-[1.4] text-mist-2">{fill(T.zeitleiste_info, vars)}</span>
        </div>
      </div>

      {/* Raketen-Legende: Modus, Starts pro Jahr und Raketen-Einheit */}
      <div className="absolute left-[max(39%,440px)] top-2 z-[3] flex items-center gap-2.5 border bg-night/85 px-3.5 py-2 text-[15px] max-md:hidden" style={{ borderColor: rkColor }}>
        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: rkColor }} />
        <span>{rkLabel}</span>
      </div>

      {/* Globus: rückt bei offenem Panel nach links und wird kleiner (Canvas: 800 → 590 px) */}
      <div
        className="absolute transition-[left,transform] duration-[800ms] ease-[cubic-bezier(.65,0,.35,1)] max-md:hidden"
        style={{
          width: "min(calc(100svh - var(--header-h) - 40px), 55vw)",
          aspectRatio: "1",
          left: panel ? "49%" : "62.5%",
          top: "50%",
          transform: `translate(-50%, ${panel ? "-46%" : "-50%"}) scale(${panel ? 0.74 : 1})`,
        }}
      >
        {failed ? (
          <p className="absolute inset-0 grid place-items-center text-center text-[15px] text-mist">3D globe not available: {failed}</p>
        ) : (
          <Globe view={view} from={{ ...d.home, lon: d.home.lon - 95 }} pins={pinList} onPins={setPins} onDrag={(v) => (setPos(v), setTouched(true))} onFail={setFailed} />
        )}

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {d.pads.map(([, , n, cc], i) => {
            const p = pins[`p${i}`];
            if (!p?.front || off(cc)) return null;
            const s = 11 + Math.sqrt(n) * 0.46;
            return (
              <span
                key={i}
                className="absolute rounded-full border-[2.5px] border-night bg-ice outline outline-[1.5px] outline-snow/75"
                style={{ left: p.x - s / 2, top: p.y - s / 2, width: s, height: s }}
              />
            );
          })}
          {sites.map((s) => {
            const p = pins[s.id];
            return p?.front ? (
              <span key={s.id} className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-red outline-2 outline-red/60" style={{ left: p.x, top: p.y }} />
            ) : null;
          })}
          {d.pads.map(([, , , cc, name], i) => {
            const p = pins[`p${i}`];
            return name && p?.front && !off(cc) ? (
              <span key={`l${i}`} className="absolute -translate-y-1/2 translate-x-3 whitespace-nowrap bg-night/80 px-1.5 text-[13px]" style={{ left: p.x, top: p.y }}>
                {name}
              </span>
            ) : null;
          })}
          {pins["k:andoya"]?.front && (
            <span className="absolute -translate-y-1/2 translate-x-3 whitespace-nowrap bg-night/80 px-1.5 text-[13px] font-semibold text-alert" style={{ left: pins["k:andoya"].x, top: pins["k:andoya"].y }}>
              Andøya · Isar
            </span>
          )}
          {rockets.map((r) => (
            <Rocket key={r.key} x={r.p.x} y={r.p.y} rot={r.p.rot + r.ang} delay={r.delay} nose={mode === "actual" ? "#ff5a4f" : "#8fd3ff"} />
          ))}
        </div>

        <div className="absolute bottom-[-6px] left-1/2 flex -translate-x-1/2 items-center gap-2">
          <button type="button" onClick={() => turn(-15)} aria-label="Rotate globe west" className="h-11 w-11 rounded-full border border-rule-strong bg-night/75 text-[18px] text-snow">
            ‹
          </button>
          <div className="nudge flex flex-col items-center gap-0.5 transition-opacity duration-500" style={{ opacity: touched ? 0 : 1 }} aria-hidden="true">
            <svg width="150" height="26" viewBox="0 0 150 26">
              <path d="M10 6 Q75 30 140 6" fill="none" stroke="#8fd3ff" strokeWidth="2" />
              <path d="M10 6 L20 4 M10 6 L16 14 M140 6 L130 4 M140 6 L134 14" stroke="#8fd3ff" strokeWidth="2" fill="none" />
            </svg>
            <span className="text-[13px] text-ice">Drag to rotate</span>
          </div>
          <button type="button" onClick={() => turn(15)} aria-label="Rotate globe east" className="h-11 w-11 rounded-full border border-rule-strong bg-night/75 text-[18px] text-snow">
            ›
          </button>
        </div>
        {away && (
          <button type="button" onClick={() => go({ ...d.home })} className="absolute left-1/2 top-2 min-h-11 -translate-x-1/2 border border-ice bg-night/80 px-3.5 text-[15px] text-ice">
            Back to Europe
          </button>
        )}
      </div>

      {panel && (
        <div className="panel-in absolute bottom-4 right-36 top-4 z-[3] flex w-[360px] flex-col gap-3 overflow-y-auto border-x-2 border-rule-strong bg-night/55 px-5 py-2 max-md:inset-x-4 max-md:w-auto max-md:bg-night">
          <div className="flex items-start gap-2.5">
            <h2 className="flex-1 text-[22px] font-semibold leading-[1.25]">{T.panel}</h2>
            <button type="button" onClick={() => setPanel(false)} aria-label="Close details" className="h-11 w-11 flex-none border border-rule-strong text-[20px]">
              ×
            </button>
          </div>
          <div className="flex flex-col gap-1 border-l-2 border-red pl-2.5 text-[14px] leading-[1.4]">
            <span>
              <b className="font-semibold text-alert">Isar {year}:</b> {Y.isar}
            </span>
            <span className="text-mist">
              Worldwide: <b className="font-semibold text-snow">{Number.isFinite(starts) ? `${trend ? "about " : ""}${nf(starts)}` : "[open]"}</b> orbital launches {Y.label},{" "}
              {Y.tonnen ? `${nf(Y.tonnen)} tonnes` : "Tonnes: forecast open"}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[40px] font-semibold leading-none">{nf(val(t, d.europa.ref))}</span>
            <span className="text-[15px] leading-[1.4] text-mist">
              {d.europa.text}, of which <b className="font-semibold text-alert">{nf(d.europa.isar)} Isar</b>
            </span>
          </div>
          <button type="button" onClick={() => setIsar(!isar)} aria-pressed={isar} className="flex min-h-11 items-center gap-3 text-left text-[15px]">
            <span className={`relative h-6 w-11 flex-none rounded-full border border-rule-strong ${isar ? "bg-ice-deep" : "bg-night-3"}`}>
              <span className="absolute top-[3px] h-4 w-4 rounded-full bg-snow transition-[left] duration-200" style={{ left: isar ? 23 : 3 }} />
            </span>
            <span>
              {T.filter} <span className="text-mist">· {T.filter_info}</span>
            </span>
          </button>
          <div className="flex flex-col text-[15px]">
            {(isar ? d.orte.isar : d.orte.alle).map(([name, n]) => (
              <div key={name} className={`flex justify-between border-b border-rule py-1.5 ${name === "Andøya" ? "text-alert" : ""}`}>
                <span>{name}</span>
                <span className="font-mono">{nf(n)}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-mist-2">{T.orte_quelle}</p>

          <div className="flex flex-col gap-1.5 border border-ice p-2">
            <span className="text-[14px] text-mist">When: launches per month {year}</span>
            {Y.monate ? (
              <>
                <div className="grid h-12 grid-cols-12 items-end gap-[3px]">
                  {Y.monate.map((v, i) => (
                    <span
                      key={i}
                      title={`${MONTHS[i]}: ${v == null ? "not yet in the catalogue" : `${nf(v)} launches`}`}
                      style={{ height: v == null ? 2 : Math.max(2, Math.round((v / maxMonth) * 48)), background: v == null ? "var(--color-rule)" : "var(--color-ice-deep)" }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-[3px] text-center font-mono text-[12px] text-mist-2" aria-hidden="true">
                  {MONTHS.map((m, i) => (
                    <span key={i}>{m[0]}</span>
                  ))}
                </div>
              </>
            ) : (
              <span className="text-[14px] text-mist-2">{year > last ? "Forecast: no monthly values" : `Monthly values only from ${d.jahre.find((y) => y.monate)?.jahr ?? "–"} in the catalogue`}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 p-2">
            <span className="text-[14px] text-mist">Where to: {Y.tonnen ? `${nf(Y.tonnen)} t payload by orbit` : `Payload by orbit (assumption: as in ${base.jahr})`}</span>
            <div className="flex h-3 bg-night-3">
              {["var(--color-ice-deep)", "var(--color-red)", "var(--color-ice)", "var(--color-rule-strong)"].map((c, i) => (
                <span key={i} style={{ width: `${Y.bahnen[i]}%`, background: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-mist">
              {(["LEO", "SSO", "Polar", "GEO, MEO, HEO"] as const).map((o, i) => (
                <span key={o}>
                  {o} <b className={`font-medium ${i === 1 ? "text-alert" : "text-snow"}`}>{n1(Y.bahnen[i])} %</b>
                </span>
              ))}
            </div>
          </div>
          <p className="text-[12px] leading-[1.45] text-mist-2">{T.fussnote}</p>
        </div>
      )}
    </section>
  );
}
