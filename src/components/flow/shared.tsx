import { useEffect, useState } from "react";
import { lookup, type Tables } from "@/lib/story";
import type { Weltmarkt } from "./WeltmarktHero";
import type { OrbitsData } from "./OrbitsBlock";
import type { StartplaetzeData } from "./StartplaetzeBlock";
import type { FabrikData } from "./FabrikBlock";
import type { EmpfehlungData } from "./EmpfehlungBlock";
import type { HeroData } from "./ProduktionHero";
import type { DeepDiveData } from "./DeepDiveFacts";

/** public/data/flow.json: Texte und Canvas-Angaben je Kapitel (Design-Canvas Skizze Flow). Der Typ je Kapitel liegt bei seiner Komponente. */
export interface FlowData {
  weltmarkt: Weltmarkt;
  orbits: OrbitsData;
  startplaetze: StartplaetzeData;
  fabrik: FabrikData;
  empfehlung: EmpfehlungData;
  hero: HeroData;
  deepdive: DeepDiveData;
}

export type Ton = "zuerst" | "versicherung" | "option" | "nicht";

/** Zahl im englischen Format (Frontend-Sprache Englisch, 22.10.2026); NaN als „–“. */
export const nf = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
export const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
/** Zahl aus den Daten-JSONs; NaN, wenn der Verweis fehlt (wird als „–“ angezeigt, nie still 0). */
export const val = (t: Tables, ref: string) => {
  const v = lookup(t, ref);
  return v && v.value !== null && v.value !== "" ? num(v.value) : NaN;
};

/** Signalfarben je Empfehlungsrolle (Canvas: Rot zuerst, Eisblau Versicherung, Bernstein Option, Grau nicht). */
export const TON: Record<Ton, string> = { zuerst: "#ff5a4f", versicherung: "#8fd3ff", option: "#f2b45a", nicht: "#8794a8" };

/** Rakete am Startort, radial nach außen gedreht; Flug und Leuchtspur als CSS-Animation (globals.css, .rkt). */
export function Rocket({ x, y, rot, delay, nose }: { x: number; y: number; rot: number; delay: string; nose: string }) {
  return (
    <div className="absolute h-0 w-0" style={{ left: x, top: y, transform: `rotate(${rot}deg)` }}>
      <div className="rkt" style={{ "--d": delay } as React.CSSProperties}>
        <svg width="12" height="34" viewBox="0 0 12 34" className="block">
          <path d="M6 0 C8.6 3 9 7.5 9 11 L9 24 L3 24 L3 11 C3 7.5 3.4 3 6 0 Z" fill="#e9edf2" />
          <path d="M6 0 C7.5 1.8 8.3 4 8.7 6.5 L3.3 6.5 C3.7 4 4.5 1.8 6 0 Z" fill={nose} />
          <rect x="3" y="12" width="6" height="1.2" fill="#8794a8" />
          <path d="M3 17 L0 25 L3 24 Z M9 17 L12 25 L9 24 Z" fill="#8794a8" />
          <path d="M3.6 24 L8.4 24 L6 33 Z" fill="#f2b45a" />
          <path d="M4.8 24 L7.2 24 L6 29.5 Z" fill="#fff3c4" />
        </svg>
        <span className="rkt-trail" />
      </div>
    </div>
  );
}

/** Feste Canvas-Geometrie (px) auf die Kapitelbreite skalieren: Rückgabe Ref und Faktor (höchstens 1). */
export function useFit<E extends HTMLElement>(designWidth: number) {
  const [el, setEl] = useState<E | null>(null);
  const [k, setK] = useState(1);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setK(Math.min(1, el.clientWidth / designWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, designWidth]);
  return [setEl, k] as const;
}
