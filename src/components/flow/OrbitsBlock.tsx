"use client";

import dynamic from "next/dynamic";
import { useState, type CSSProperties } from "react";
import { useSeen, type Tables } from "@/lib/story";
import { nf, useFit, val } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

const VERDICT: Record<string, string> = { verfolgen: "#7ee0b5", spaeter: "#f2b45a", nicht: "#8794a8" };
// Canvas-Geometrie (Artboard 2): Bühne 780 × 620, Erdmitte 390/310, Erdradius 193 px; Globus-Kasten 420 px ab 180/100.
const W = 1296;
const H = 660;
const VIEW = { lat: 30, lon: 14, dist: 3.92 };
// Vordere Bahnhälfte über dem Globus: untere Hälfte der (gedrehten) Ellipse.
const FRONT = "polygon(-15% 50%, 115% 50%, 115% 160%, -15% 160%)";
// Rausgezoomt: Stufe 1 Nukleus groß in der Mitte, Stufe 2 klein in der Mitte der drei Ringe (Mitte der Ringe = NUC_OUT).
const NUC_FAR = { d: 320, x: 648, y: 280, fs: 34 };
const NUC_OUT = { d: 120, x: 620, y: 280, fs: 14 };
const INSIDE = 150; // ab diesem Durchmesser steht der Name in der Kugel
const BUB_DELAY = 0.1;
const BUB_STAGGER = 0.08;
const EASE = "cubic-bezier(.65,0,.35,1)";
const STAGE_T = `left .8s ${EASE}, transform .9s ${EASE}, opacity .6s ease, visibility .6s`;
const NUC_T = ["left", "top", "width", "height", "font-size"].map((p) => `${p} .9s ${EASE}`).join(", ");
const NUC_BG = "radial-gradient(circle at 33% 27%, #3a3f4a 0%, #14171e 22%, #05060a 55%, #000000 100%)";
const NUC_SHADOW =
  "inset -14px -18px 36px rgba(0,0,0,0.9), inset 6px 8px 22px rgba(255,255,255,0.10), 0 0 0 1px rgba(255,90,79,0.55), 0 0 36px 6px rgba(255,90,79,0.28), 0 0 90px 18px rgba(255,90,79,0.10)";
const BUB_BG = "radial-gradient(circle at 32% 26%, #6f86a8 0%, #3a4f73 24%, #1b2b47 56%, #0a1220 100%)";
const BUB_SHADOW =
  "inset -10px -14px 28px rgba(3,8,18,0.85), inset 4px 6px 16px rgba(190,215,255,0.22), 0 0 0 1px rgba(143,211,255,0.35), 0 0 26px 3px rgba(143,211,255,0.18), 0 22px 26px -10px rgba(0,0,0,0.7)";
const GLOSS = "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)";

const ring = (r: Bahn): CSSProperties => ({ left: 390 - r.rx, top: 310 - r.ry, width: 2 * r.rx, height: 2 * r.ry, transform: `rotate(${r.rot}deg)` });
const path = (r: Bahn) => `path('M 0 ${r.ry} A ${r.rx} ${r.ry} 0 1 1 ${2 * r.rx} ${r.ry} A ${r.rx} ${r.ry} 0 1 1 0 ${r.ry}')`;
/** Marktgröße in Mrd. USD: ab 100 ohne Nachkomma ($105B), sonst eine Stelle ($8.5B). */
const usd = (v: number) => `$${nf(v, v >= 100 ? 0 : 1)}B`;

export interface OrbitsData {
  titel: string;
  titel_fern: string;
  titel_aussen: string;
  hinweis: string;
  fuss_fern: string;
  fuss_aussen: string;
  quelle: string;
  stufen: string[];
  bahnen: Bahn[];
  geschaeft: Geschaeft;
}

/** Rausgezoomt: Nukleus LaaS und Geschäftsmodelle der Case-DB in drei Ringen; Kugelfläche ∝ Marktgröße. */
export interface Geschaeft {
  kern: string;
  /** val-Verweis auf die Marktgröße des Nukleus (Mrd. USD). */
  kern_ref: string;
  /** Legende je Urteil (Schlüssel wie business_models.verdict). */
  urteile: Record<string, string>;
  ringe: { label: string; rx: number; ry: number }[];
  /** ring = Index in ringe, deg = Winkel auf der Ellipse (0° rechts, im Uhrzeigersinn). */
  modelle: { name: string; ref: string; ring: number; deg: number; urteil: string }[];
}

export interface Bahn {
  id: string;
  label: string;
  rx: number;
  ry: number;
  rot: number;
  color: string;
  style: string;
  dur: number;
  delays: number[];
  lx: number;
  ly: number;
  name: string;
  band: string;
  strat: string;
  step: number;
  alt: string;
  n: number;
  mass: string;
  open: number;
  cap: number;
  lock: number;
  nt: number;
  use: string;
  cust: string;
  isar: string;
  text: string;
}

/**
 * Frage 1 (Artboard 2): fünf Bahnen um den Globus, Klick öffnet die Bahn. Rauszoomen in zwei Stufen über Knöpfe
 * (kein Mausrad, die Seite scrollt frei): erst nur der Nukleus LaaS, dann die Geschäftsmodelle in drei Ringen.
 */
export function OrbitsBlock({ d, t }: { d: OrbitsData; t: Tables }) {
  const [pick, setPick] = useState<string | null>(null);
  const [far, setFar] = useState(false);
  const [outer, setOuter] = useState(false);
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const [fitRef, k] = useFit<HTMLDivElement>(W);
  const o = !far ? d.bahnen.find((b) => b.id === pick) : undefined;
  const g = d.geschaeft;
  const kern = val(t, g.kern_ref);
  const nuc = outer ? NUC_OUT : NUC_FAR;
  // Modelle ohne Marktgröße in der DB fallen weg (Fußnote im Mockup).
  const bubbles = g.modelle
    .map((m) => {
      const v = val(t, m.ref);
      const r = g.ringe[m.ring];
      const a = (m.deg * Math.PI) / 180;
      return { ...m, v, d: Math.round(NUC_OUT.d * Math.sqrt(v / kern)), x: NUC_OUT.x + r.rx * Math.cos(a), y: NUC_OUT.y + r.ry * Math.sin(a) };
    })
    .filter((b) => Number.isFinite(b.d));

  const layer = (front: boolean) => (
    <div className="ringin pointer-events-none absolute inset-0" style={{ zIndex: front ? 3 : 1 }}>
      {d.bahnen.map((r) => (
        <div key={r.id} className="absolute" style={{ ...ring(r), clipPath: front ? FRONT : undefined }}>
          <div className="absolute inset-0 rounded-full" style={{ border: `${r.id === pick ? 3 : 1.5}px ${r.style} ${r.color}`, opacity: front ? 1 : 0.45 }} />
        </div>
      ))}
      {d.bahnen.flatMap((r) =>
        r.delays.map((delay, i) => {
          const style: CSSProperties = { offsetPath: path(r), animationDuration: `${r.dur}s`, animationDelay: `${delay}s` };
          return (
            <div key={`${r.id}${i}`} className="absolute" style={{ ...ring(r), clipPath: front ? FRONT : undefined }}>
              {front ? (
                <button type="button" className="sat pointer-events-auto" onClick={() => setPick(r.id)} aria-label={`Satellite ${r.name}`} style={style}>
                  <Sat color={r.color} />
                </button>
              ) : (
                <span className="sat" aria-hidden="true" style={style}>
                  <Sat color={r.color} />
                </span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );

  const pct = (x: number) => `${((100 * x) / (o?.n || 1)).toFixed(1)}%`;

  return (
    <div ref={fitRef} className="w-full">
      <p className="mb-4 font-display text-[26px] font-semibold leading-tight">{!far ? d.titel : outer ? d.titel_aussen : d.titel_fern}</p>
      <div ref={seenRef} style={{ height: H * k }}>
        <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${k})` }}>
          {outer && (
            <div className="absolute inset-0 z-0">
              <div className="bub-in absolute inset-0" style={{ transformOrigin: `${NUC_OUT.x}px ${NUC_OUT.y}px` }}>
                {g.ringe.map((r) => (
                  <div key={r.label}>
                    <div className="absolute rounded-full border-[1.5px] border-dashed border-rule" style={{ left: NUC_OUT.x - r.rx, top: NUC_OUT.y - r.ry, width: 2 * r.rx, height: 2 * r.ry }} />
                    <span
                      className="absolute -translate-x-1/2 -translate-y-1/2 bg-night px-1.5 font-mono text-[12px] uppercase tracking-[0.12em] text-mist-2"
                      style={{ left: NUC_OUT.x, top: NUC_OUT.y - r.ry }}
                    >
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>
              {bubbles.map((b, i) => {
                const label = (
                  <>
                    <span>
                      <span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-full align-middle" style={{ background: VERDICT[b.urteil] }} title={g.urteile[b.urteil]} />
                      {b.name}
                    </span>
                    <span className="font-mono text-[12px] text-ice">{usd(b.v)}</span>
                  </>
                );
                return (
                  <div
                    key={b.name}
                    className="bub-in absolute flex flex-col items-center gap-1.5"
                    style={{ left: b.x - b.d / 2, top: b.y - b.d / 2, width: b.d, animationDelay: `${BUB_DELAY + i * BUB_STAGGER}s` }}
                  >
                    <div
                      className="relative flex flex-none flex-col items-center justify-center rounded-full p-2.5 text-center text-[15px] leading-[1.2]"
                      style={{ width: b.d, height: b.d, background: BUB_BG, boxShadow: BUB_SHADOW }}
                    >
                      <span aria-hidden="true" className="absolute left-[20%] top-[12%] h-[20%] w-[30%] -rotate-30 rounded-full" style={{ background: GLOSS }} />
                      {b.d >= INSIDE && label}
                    </div>
                    {b.d < INSIDE && <div className="flex w-[190px] flex-col items-center text-center text-[14px] leading-tight">{label}</div>}
                  </div>
                );
              })}
              <div className="absolute right-0 top-0 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-mist">
                {Object.entries(g.urteile).map(([v, l]) => (
                  <span key={v}>
                    <span className="mr-1.5 inline-block h-[9px] w-[9px] rounded-full" style={{ background: VERDICT[v] }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {far && (
            <div className="biz-in pointer-events-none absolute inset-0 z-0">
              <div
                className="absolute flex flex-col items-center justify-center gap-1 rounded-full p-2 text-center font-semibold leading-[1.15]"
                style={{ left: nuc.x - nuc.d / 2, top: nuc.y - nuc.d / 2, width: nuc.d, height: nuc.d, fontSize: nuc.fs, transition: NUC_T, background: NUC_BG, boxShadow: NUC_SHADOW }}
              >
                <span>{g.kern}</span>
                <span className="font-mono text-[0.6em] font-medium text-ice">{usd(kern)}</span>
              </div>
            </div>
          )}

          {seen && (
            <div
              className="absolute top-0"
              style={{
                left: o ? 0 : 258,
                width: 780,
                height: 620,
                transform: `scale(${far ? 0.42 : 1})`,
                transformOrigin: "390px 310px",
                opacity: far ? 0 : 1,
                visibility: far ? "hidden" : "visible",
                transition: STAGE_T,
              }}
            >
              {layer(false)}
              <div className="zoomout absolute z-[2]" style={{ left: 180, top: 100, width: 420, height: 420 }}>
                <Globe view={VIEW} />
              </div>
              {layer(true)}
              <div className="ringin pointer-events-none absolute inset-0 z-[4]">
                {d.bahnen.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPick(r.id)}
                    className={`pointer-events-auto absolute min-h-8 border bg-night/80 px-2 py-0.5 text-[14px] ${r.id === "sso" ? "border-red font-semibold text-white" : r.id === "polar" ? "border-rule text-ice" : "border-rule text-mist"}`}
                    style={{ left: r.lx, top: r.ly }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!o && !far && <span className="absolute left-0 top-0 text-[15px] text-mist">{d.hinweis}</span>}
          <div className="absolute bottom-14 left-0 z-[5] flex flex-col items-start gap-2">
            {far && (
              <button
                type="button"
                onClick={() => setOuter(!outer)}
                className="flex min-h-11 items-center gap-2 border border-mist bg-night-2 px-3.5 text-[15px] text-snow"
              >
                {outer ? "↙ Hide other business models" : "↗ Show other business models"}
              </button>
            )}
            <button
              type="button"
              onClick={() => (setFar(!far), setPick(null), setOuter(false))}
              className="flex min-h-11 items-center gap-2 border border-ice bg-night-2 px-3.5 text-[15px] text-ice"
            >
              {far ? "↑ Back to orbits" : "↓ Zoom out: other business models"}
            </button>
          </div>

          {o && (
            <div className="panel-in absolute right-0 top-0 z-[5] flex w-[470px] flex-col gap-4">
              <div className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <span className="text-[14px] text-mist">Proximity to core business</span>
                  <div className="grid grid-cols-5 gap-1">
                    {d.stufen.map((label, i) => (
                      <div key={label} className="flex flex-col gap-1.5">
                        <span className="h-1.5" style={{ background: i === o.step ? (i === 0 ? "var(--color-red)" : "var(--color-ice)") : "var(--color-rule)" }} />
                        <span className={`text-[13px] ${i === o.step ? "text-snow" : "text-mist-2"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setPick(null)} aria-label="Close details" className="h-11 w-11 flex-none border border-rule-strong text-[20px]">
                  ×
                </button>
              </div>
              <div className="flex flex-col gap-3.5 border border-rule bg-night-2 px-[22px] py-5">
                <div className="flex flex-col gap-1">
                  <span className={`font-mono text-[12px] uppercase tracking-[0.12em] ${o.step === 0 ? "text-alert" : "text-ice"}`}>{o.strat}</span>
                  <span className="text-[26px] font-semibold leading-[1.15]">{o.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ["Altitude", o.alt],
                    ["Inclination", o.band],
                    ["Satellites 2025", nf(o.n)],
                    ["Mass 2025", o.mass],
                  ].map(([l, v]) => (
                    <div key={l} className="flex flex-col gap-0.5">
                      <span className="text-[13px] text-mist">{l}</span>
                      <span className="text-[15px] font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-mist">Market opportunities</span>
                  <div className="flex h-3 bg-night-3">
                    <span style={{ width: pct(o.open), background: "#7ee0b5" }} />
                    <span style={{ width: pct(o.cap), background: "#4fa3d9" }} />
                    <span style={{ width: pct(o.lock), background: "#f2b45a" }} />
                    <span style={{ width: pct(o.nt), background: "#3d5272" }} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-mist">
                    <span>
                      <b className="font-semibold text-aurora">{nf(o.open)}</b> open
                    </span>
                    <span>
                      <b className="font-semibold text-ice">{nf(o.cap)}</b> captive
                    </span>
                    <span>
                      <b className="font-semibold text-amber">{nf(o.lock)}</b> restricted
                    </span>
                    <span>
                      <b className="font-semibold text-snow">{nf(o.nt)}</b> not Spectrum-suitable
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[15px] leading-[1.45]">
                  <span>
                    <span className="text-mist">Use:</span> {o.use}
                  </span>
                  <span>
                    <span className="text-mist">Customers:</span> {o.cust}
                  </span>
                  <span>
                    <span className="text-mist">For Isar:</span> {o.isar}
                  </span>
                </div>
                <p className="border-t border-rule pt-3 text-[16px] leading-normal">{o.text}</p>
              </div>
              <span className="text-[13px] text-mist-2">{d.quelle}</span>
            </div>
          )}

          {/* Nah-Ansicht ohne Fußzeile (Entscheidung 22.10.2026); rausgezoomt bleibt der Hinweis zu den Geschäftsmodellen. */}
          {far && (
            <div className="absolute inset-x-0 bottom-0 border-t border-rule pt-3 text-[15px] text-mist">{outer ? d.fuss_aussen : d.fuss_fern}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sat({ color }: { color: string }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <rect x="7" y="3" width="4" height="6" fill="#ffffff" />
      <rect x="0.5" y="4" width="5" height="4" fill="none" stroke={color} />
      <rect x="12.5" y="4" width="5" height="4" fill="none" stroke={color} />
    </svg>
  );
}
