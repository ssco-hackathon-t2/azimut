"use client";

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Tables } from "@/lib/story";
import { nf, val } from "./shared";
import type { Geschaeft } from "./OrbitsBlock";

/** Marktgröße in Mrd. USD: ab 100 ohne Nachkomma ($105B), sonst eine Stelle ($8.5B). */
export const usd = (v: number) => `$${nf(v, v >= 100 ? 0 : 1)}B`;

const INSIDE = 150; // ab diesem Durchmesser steht der Name auf dem Planeten
// Licht wie bei der Erde in der Orbit-Ansicht: von vorn oben links, Rand dunkler.
const SHADE =
  "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 32%, rgba(0,0,0,0) 48%, rgba(3,6,14,0.55) 80%, rgba(2,4,10,0.9) 100%)";
const spot = (w: number, h: number, x: number, y: number, c: string) => `radial-gradient(ellipse ${w}% ${h}% at ${x}% ${y}%, ${c} 0%, transparent 100%)`;
const crater = (x: number, y: number, r: number, c: string) => `radial-gradient(circle at ${x}% ${y}%, ${c} 0 ${r}%, transparent ${r + 1.5}%)`;
/** Oberflächen ohne Texturdateien: Bänder und Flecken als Verläufe, darüber dieselbe Beleuchtung (SHADE). */
const SURFACE: Record<string, string> = {
  jupiter: [
    spot(17, 9, 64, 64, "#b4553a"),
    "linear-gradient(172deg, #c9a27e 0%, #e9d8bd 9%, #b98a63 15%, #efe2cc 22%, #c79a72 30%, #a5714c 36%, #e6d2b4 42%, #f3e9d8 50%, #c08e66 57%, #e2cbaa 64%, #b07f5a 71%, #ead9bf 79%, #c69d78 88%, #a87a57 100%)",
  ].join(", "),
  saturn: "linear-gradient(175deg, #c8ab78 0%, #e6d3a6 18%, #d4b985 30%, #efe0bb 45%, #d8bf8e 60%, #e9d8b0 75%, #bfa070 100%)",
  uranus: "linear-gradient(170deg, #c4eff2 0%, #a6e0e6 40%, #93d2da 70%, #7cc0ca 100%)",
  neptune: [spot(16, 9, 40, 58, "#1c2e78"), "linear-gradient(172deg, #6283ea 0%, #3d5fd1 35%, #4a6fe0 55%, #2f4bb3 100%)"].join(", "),
  venus: [spot(60, 30, 40, 40, "rgba(255,245,215,0.6)"), "linear-gradient(160deg, #f1dfb0 0%, #e2c58c 50%, #cfa96a 100%)"].join(", "),
  mars: [
    spot(32, 10, 50, 4, "#f4efe9"),
    spot(36, 18, 56, 56, "#7c2f16"),
    spot(26, 14, 30, 38, "#8e3a1c"),
    "linear-gradient(160deg, #de7444 0%, #c1501f 50%, #a8431c 100%)",
  ].join(", "),
  mercury: [crater(30, 40, 7, "#77716c"), crater(62, 30, 5, "#807a75"), crater(55, 66, 9, "#7a746f"), crater(24, 70, 4, "#85807a"), "#a39d97"].join(", "),
  moon: [spot(24, 17, 38, 36, "#8d8b87"), spot(18, 14, 62, 50, "#93918d"), spot(14, 10, 46, 70, "#9a9894"), crater(70, 74, 4, "#a9a6a0"), "#cfccc6"].join(", "),
  pluto: [spot(26, 22, 58, 58, "#f3e8da"), spot(40, 20, 24, 70, "#6b4a38"), "linear-gradient(160deg, #d6bc9e 0%, #c3a382 100%)"].join(", "),
};
const RING = "radial-gradient(closest-side, transparent 60%, rgba(214,194,150,0.85) 62%, rgba(150,128,92,0.55) 71%, rgba(232,214,174,0.85) 80%, rgba(140,120,90,0.45) 91%, transparent 100%)";
const MUTED = "#8794a8";
const ARROW = "grid h-11 w-11 place-items-center rounded-full border border-rule-strong bg-night/75 text-[18px] text-snow";

/** Kugel mit Oberfläche und Beleuchtung; Saturn mit Ring (hintere Hälfte hinter, vordere vor der Kugel). */
function Planet({ kind, d }: { kind: string; d: number }) {
  const box: CSSProperties = { left: -d / 2, top: -d / 2, width: d, height: d };
  const ring: CSSProperties = { left: -1.15 * d, top: -0.3 * d, width: 2.3 * d, height: 0.6 * d, background: RING };
  return (
    <div aria-hidden="true" className="absolute left-0 top-0" style={kind === "saturn" ? { transform: "rotate(-14deg)" } : undefined}>
      {kind === "saturn" && <div className="absolute rounded-full" style={ring} />}
      <div className="absolute rounded-full" style={{ ...box, background: `${SHADE}, ${SURFACE[kind] ?? SURFACE.moon}`, boxShadow: "0 0 18px 2px rgba(143,211,255,0.08)" }} />
      {kind === "saturn" && <div className="absolute rounded-full" style={{ ...ring, clipPath: "inset(50% 0 0 0)" }} />}
    </div>
  );
}

/**
 * Stufe 2 der Orbits-Szene: drehbares Sonnensystem um den Nukleus. Geschäftsmodelle als Planeten auf drei Bahnen
 * (Nähe zum Kerngeschäft), Fläche ∝ Marktgröße. Ziehen oder Pfeile drehen, innere Bahnen schneller (ringe[].speed).
 * Einblenden über die CSS-Variable --pd (0–1) der Bühne, Beschriftungen gegen kleine Skalierung über --lab.
 */
export function SolarSystem({ g, t, kern, d0, cx, cy, active }: { g: Geschaeft; t: Tables; kern: number; d0: number; cx: number; cy: number; active: boolean }) {
  // Modelle ohne Marktgröße in der DB fallen weg (Fußnote).
  const items = useMemo(
    () =>
      g.modelle
        .map((m) => {
          const v = val(t, m.ref);
          return { ...m, v, d: Math.round(d0 * Math.sqrt(v / kern)) };
        })
        .filter((m) => Number.isFinite(m.d)),
    [g, t, kern, d0],
  );
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const rot = useRef({ cur: 0, to: 0, raf: 0, drag: null as null | { x: number; rot: number } });

  // Lage je Planet direkt am DOM (kein React-Render pro Frame); hintere Bahnhälfte unter dem Nukleus.
  const place = () => {
    items.forEach((m, i) => {
      const el = refs.current[i];
      const r = g.ringe[m.ring];
      if (!el || !r) return;
      const a = ((m.deg + rot.current.cur * (r.speed ?? 1)) * Math.PI) / 180;
      el.style.translate = `${(cx + r.rx * Math.cos(a)).toFixed(1)}px ${(cy + r.ry * Math.sin(a)).toFixed(1)}px`;
      el.style.zIndex = Math.sin(a) < 0 ? "0" : "2";
    });
  };
  useLayoutEffect(place);
  useLayoutEffect(() => () => cancelAnimationFrame(rot.current.raf), []);

  const tick = () => {
    const s = rot.current;
    s.cur += (s.to - s.cur) * 0.14;
    if (Math.abs(s.to - s.cur) < 0.05) s.cur = s.to;
    place();
    s.raf = s.cur !== s.to ? requestAnimationFrame(tick) : 0;
  };
  const turn = (by: number) => {
    const s = rot.current;
    s.to += by;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.cur = s.to;
      place();
    } else if (!s.raf) s.raf = requestAnimationFrame(tick);
  };
  // Einblenden gestaffelt je Planet über --pd.
  const grow = (i: number): CSSProperties => {
    const x = `clamp(0, calc(var(--pd) * 2.4 - ${(i * 0.15).toFixed(2)}), 1)`;
    return { opacity: x, scale: `calc(0.6 + 0.4 * ${x})` };
  };
  const lab = (origin: string): CSSProperties => ({ transform: "translateX(-50%) scale(var(--lab))", transformOrigin: origin });

  return (
    <div
      inert={!active}
      className="absolute inset-0"
      style={{ cursor: active ? "grab" : undefined, pointerEvents: active ? undefined : "none", touchAction: "pan-y" }}
      onPointerDown={(e) => {
        if (!active || (e.target as Element).closest("button")) return;
        rot.current.drag = { x: e.clientX, rot: rot.current.cur };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const s = rot.current;
        if (!s.drag) return;
        s.to = s.cur = s.drag.rot + (e.clientX - s.drag.x) * 0.4;
        place();
      }}
      onPointerUp={() => (rot.current.drag = null)}
      onPointerCancel={() => (rot.current.drag = null)}
    >
      {g.ringe.map((r) => (
        <div key={r.label} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ ...grow(0), transformOrigin: `${cx}px ${cy}px` }}>
          <span className="absolute rounded-[50%] border-[1.5px] border-dashed" style={{ left: cx - r.rx, top: cy - r.ry, width: 2 * r.rx, height: 2 * r.ry, borderColor: r.color ?? MUTED }} />
          <span
            className="absolute whitespace-nowrap bg-night px-1.5 font-mono text-[12px] uppercase tracking-[0.1em]"
            style={{ left: cx, top: cy - r.ry - 9, color: r.color ?? MUTED, ...lab("50% 50%") }}
          >
            {r.label}
          </span>
        </div>
      ))}
      {items.map((m, i) => {
        const inside = m.d >= INSIDE;
        return (
          <div key={m.name} ref={(el) => void (refs.current[i] = el)} className="pointer-events-none absolute left-0 top-0" style={grow(i)}>
            <Planet kind={m.planet ?? "moon"} d={m.d} />
            <span
              className={`absolute left-0 flex flex-col items-center whitespace-nowrap text-center leading-[1.2] ${inside ? "bg-night/80 px-2.5 py-1.5 text-[15px]" : "w-[160px] text-[14px]"}`}
              style={{ top: inside ? -20 : m.d / 2 + 6, ...lab("50% 0") }}
            >
              <span className={inside ? undefined : "whitespace-normal"}>{m.name}</span>
              <span className="font-mono text-[12px] text-ice">{usd(m.v)}</span>
            </span>
          </div>
        );
      })}
      <div className="absolute bottom-14 z-[4] flex items-center gap-2" style={{ left: cx, opacity: "var(--pd)", ...lab("50% 100%") }}>
        <button type="button" onClick={() => turn(-25)} aria-label={g.drehen?.zurueck} className={ARROW}>
          ‹
        </button>
        <span className="nudge flex flex-col items-center gap-0.5" aria-hidden="true">
          <svg width="120" height="22" viewBox="0 0 150 26">
            <path d="M10 6 Q75 30 140 6 M10 6 L20 4 M10 6 L16 14 M140 6 L130 4 M140 6 L134 14" fill="none" stroke="#8fd3ff" strokeWidth="2" />
          </svg>
          <span className="text-[13px] text-ice">{g.drehen?.hinweis}</span>
        </span>
        <button type="button" onClick={() => turn(25)} aria-label={g.drehen?.vor} className={ARROW}>
          ›
        </button>
      </div>
    </div>
  );
}
