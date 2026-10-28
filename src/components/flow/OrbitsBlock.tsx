"use client";

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSeen, type Tables } from "@/lib/story";
import { nf, val } from "./shared";
import { SolarSystem, usd } from "./OrbitsPlanets";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

// Canvas-Geometrie (Artboard 2): Bühne 1296 × 660; Orbit-Teilbühne 780 × 620 ab x 258, Erdmitte 390/310, Erdradius 193 px.
const W = 1296;
const H = 660;
const VIEW = { lat: 30, lon: 14, dist: 3.92 };
// Globus-Kasten 800 px (scharf in der Nahansicht), in der Orbit-Ansicht auf 420 px skaliert.
const GLOBE_BOX = 800;
const GLOBE_FIT = 420 / GLOBE_BOX;
const R = 193;
// Vordere Bahnhälfte über dem Globus: untere Hälfte der (gedrehten) Ellipse.
const FRONT = "polygon(-15% 50%, 115% 50%, 115% 160%, -15% 160%)";
// Nukleus: Mitte 648/290; Erddurchmesser in Stufe 1 (nur Nukleus) und Stufe 2 (mit Planeten), Schrift der Beschriftung.
const CX = 648;
const CY = 290;
const NUC_D = 340;
const OUT_D = 110;
const NUC_FS = 30;
const OUT_FS = 14;
// Ersatztexte, falls flow.json die Knöpfe (noch) nicht enthält.
const KNOEPFE = { fern: "↓ Zoom out: other business models", zurueck: "↑ Back to orbits", aussen: "↗ Show other business models", innen: "↙ Hide other business models", schliessen: "Close details" };
const GLOW = "0 0 0 2px rgba(255,90,79,0.6), 0 0 36px 6px rgba(255,90,79,0.28), 0 0 90px 18px rgba(255,90,79,0.10)";

/*
 * Scroll-Sequenz: Fortschritt p 0–1 über den Scroll-Container (SCROLL_VH hoch, Bühne sticky).
 * A 0–0.22 Erde zoomt aus der Nahansicht (Skalierung S0 → 1), Bahnen blenden ein · B bis 0.48 Bahnen klickbar ·
 * C 0.48–0.62 Bahnen schrumpfen in die Erde, Erde wird Nukleus mit rotem Glühen · D 0.74–0.86 Nukleus klein, Planeten 0.76–0.92.
 */
const SCROLL_VH = 340;
const S0 = 1.9;
const PHASE_FROM = [0.16, 0.5, 0.76]; // Grenzen A|B, B|C, C|D
const AT = [0, 0.35, 0.69, 0.97]; // Ziel der Knöpfe je Phase
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const phaseOf = (p: number) => PHASE_FROM.filter((x) => p >= x).length;

const ring = (r: Bahn): CSSProperties => ({ left: 390 - r.rx, top: 310 - r.ry, width: 2 * r.rx, height: 2 * r.ry, transform: `rotate(${r.rot}deg)` });
const path = (r: Bahn) => `path('M 0 ${r.ry} A ${r.rx} ${r.ry} 0 1 1 ${2 * r.rx} ${r.ry} A ${r.rx} ${r.ry} 0 1 1 0 ${r.ry}')`;

export interface OrbitsData {
  titel: string;
  titel_fern: string;
  titel_aussen: string;
  hinweis: string;
  fuss_fern: string;
  fuss_aussen: string;
  quelle: string;
  /** Knöpfe: fern = rauszoomen, zurueck = zurück zu den Bahnen, aussen/innen = Geschäftsmodelle ein-/ausblenden. */
  knoepfe?: Partial<typeof KNOEPFE>;
  stufen: string[];
  bahnen: Bahn[];
  geschaeft: Geschaeft;
}

/** Rausgezoomt: Nukleus LaaS und Geschäftsmodelle der Case-DB als Planeten auf drei Bahnen; Kugelfläche ∝ Marktgröße. */
export interface Geschaeft {
  kern: string;
  /** val-Verweis auf die Marktgröße des Nukleus (Mrd. USD). */
  kern_ref: string;
  drehen?: { hinweis?: string; zurueck?: string; vor?: string };
  /** Bahnen um den Nukleus (Nähe zum Kerngeschäft); speed = Drehfaktor, innere Bahnen schneller. */
  ringe: { label: string; rx: number; ry: number; color?: string; speed?: number }[];
  /** ring = Index in ringe, deg = Startwinkel auf der Ellipse (0° rechts, im Uhrzeigersinn), planet = Aussehen. */
  modelle: { name: string; ref: string; ring: number; deg: number; planet?: string }[];
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
 * Frage 1 (Artboard 2) als Scroll-Sequenz: Die Erde zoomt aus der Nahansicht in den Orbit (fünf Bahnen, Klick öffnet
 * die Bahn), dann schrumpft das Orbit-System zum Nukleus „Launch as a Service“ und zuletzt erscheinen die übrigen
 * Geschäftsmodelle als Planeten. Die Seite scrollt normal (Bühne sticky, kein Mausrad-Kapern); Knöpfe springen per
 * scrollTo an die Stufe. Kontinuierliche Werte als CSS-Variablen am Sticky-Element, React-State nur beim Phasenwechsel.
 * Reduzierte Bewegung: kein Scroll-Kopplung, die Stufen wechseln per Knopf.
 */
export function OrbitsBlock({ d, t }: { d: OrbitsData; t: Tables }) {
  const [pick, setPick] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [still, setStill] = useState(false); // prefers-reduced-motion
  const [mobile, setMobile] = useState(false);
  const [fine, setFine] = useState(false); // Maus: Globus ziehbar; Touch: Wischen scrollt immer die Seite
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const scrollEl = useRef<HTMLDivElement | null>(null);
  const stick = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const st = useRef({ p: 0, kNear: 1, kFar: 1, phase: 0 });
  const kern = val(t, d.geschaeft?.kern_ref ?? "");
  const k = { ...KNOEPFE, ...d.knoepfe };

  // Zustand für Fortschritt p auf die CSS-Variablen schreiben; nur ein Phasenwechsel löst ein React-Render aus.
  const apply = useRef(() => {});
  apply.current = () => {
    const el = stick.current;
    if (!el) return;
    const { p, kNear, kFar } = st.current;
    const a = ease(seg(p, 0, 0.22));
    const c = ease(seg(p, 0.48, 0.6));
    const n = ease(seg(p, 0.5, 0.62));
    const z = ease(seg(p, 0.74, 0.86));
    const sNuc = NUC_D / (2 * R);
    const s = lerp(S0, 1, a) * lerp(1, sNuc, n) * lerp(1, OUT_D / NUC_D, z);
    const kk = lerp(kNear, kFar, z);
    const vars: Record<string, number> = {
      "--k": kk,
      "--lab": Math.max(1, 0.75 / kk),
      "--s": s,
      "--y": lerp(0, CY - 310, n),
      "--ro": seg(p, 0.08, 0.22) * (1 - c),
      "--rs": lerp(1, 0.5, c),
      "--glow": seg(p, 0.54, 0.64),
      "--nl": seg(p, 0.56, 0.66),
      "--ns": lerp(1, OUT_FS / NUC_FS, z),
      "--pd": seg(p, 0.76, 0.92),
    };
    for (const [key, v] of Object.entries(vars)) el.style.setProperty(key, v.toFixed(4));
    const ph = phaseOf(p);
    if (ph !== st.current.phase) {
      st.current.phase = ph;
      setPhase(ph);
      setPick(null);
    }
  };

  useEffect(() => {
    const mq = (q: string) => window.matchMedia(q);
    setStill(mq("(prefers-reduced-motion: reduce)").matches);
    setFine(mq("(pointer: fine)").matches);
    const m = mq("(max-width: 767px)");
    const onM = () => setMobile(m.matches);
    onM();
    m.addEventListener("change", onM);
    return () => m.removeEventListener("change", onM);
  }, []);

  // Bühnenfaktor aus dem Platz: Desktop ganze Bühne; mobil nur der Ausschnitt um die Erde.
  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const fit = (w: number) => Math.min(1, el.clientWidth / w, el.clientHeight / H);
      // ponytail: mobil schneidet Stufe 2 die äußere Bahn seitlich an (900 statt 1296 px); Drehen holt Planeten ins Bild.
      st.current.kFar = fit(mobile ? 900 : W);
      st.current.kNear = fit(mobile ? 800 : W);
      apply.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  // Scroll-Fortschritt relativ zum eigenen Container (passiv, ein Lesen und Schreiben pro Frame).
  useLayoutEffect(() => {
    if (still) {
      st.current.p = AT[Math.max(1, st.current.phase)];
      apply.current();
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      const sc = scrollEl.current;
      const el = stick.current;
      if (!sc || !el) return;
      const total = sc.offsetHeight - el.offsetHeight;
      st.current.p = total > 0 ? clamp((el.getBoundingClientRect().top - sc.getBoundingClientRect().top) / total) : 0;
      apply.current();
    };
    const on = () => void (raf ||= requestAnimationFrame(read));
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [still]);

  const go = (ph: number) => {
    if (still) {
      st.current.p = AT[ph];
      return apply.current();
    }
    const sc = scrollEl.current;
    const el = stick.current;
    if (!sc || !el) return;
    const top = sc.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(el).top || "0") + AT[ph] * (sc.offsetHeight - el.offsetHeight);
    window.scrollTo({ top, behavior: "smooth" });
  };

  const o = phase === 1 ? d.bahnen.find((b) => b.id === pick) : undefined;
  const shift = o && !mobile;
  const pct = (x: number) => `${((100 * x) / (o?.n || 1)).toFixed(1)}%`;
  const labScale = (origin: string): CSSProperties => ({ transform: "scale(var(--lab))", transformOrigin: origin });

  const layer = (front: boolean) => (
    <div inert={phase !== 1} className="pointer-events-none absolute inset-0" style={{ zIndex: front ? 3 : 1 }}>
      {d.bahnen.map((r) => (
        <div key={r.id} className="absolute" style={{ ...ring(r), clipPath: front ? FRONT : undefined }}>
          <div className="absolute inset-0 rounded-[50%]" style={{ border: `${r.id === pick ? 3 : 1.5}px ${r.style} ${r.color}`, opacity: front ? 1 : 0.45 }} />
        </div>
      ))}
      {d.bahnen.flatMap((r) =>
        r.delays.map((delay, i) => {
          const style: CSSProperties = { offsetPath: path(r), animationDuration: `${r.dur}s`, animationDelay: `${delay}s`, animationPlayState: phase === 3 ? "paused" : undefined };
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

  const panel = o && (
    <>
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
        <button type="button" onClick={() => setPick(null)} aria-label={k.schliessen} className="h-11 w-11 flex-none border border-rule-strong text-[20px]">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-3.5 border border-rule bg-night-2 px-[22px] py-5">
        <div className="flex flex-col gap-1">
          <span className={`font-mono text-[12px] uppercase tracking-[0.12em] ${o.step === 0 ? "text-alert" : "text-ice"}`}>{o.strat}</span>
          <span className="text-[26px] font-semibold leading-[1.15]">{o.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    </>
  );

  const btn = (label: string, to: number, primary: boolean): ReactNode => (
    <button
      key={label}
      type="button"
      onClick={() => go(to)}
      className={`flex min-h-11 items-center gap-2 border bg-night-2 px-3.5 text-[15px] ${primary ? "border-ice text-ice" : "border-mist text-snow"}`}
    >
      {label}
    </button>
  );
  const buttons = phase <= 1 ? [btn(k.fern, 2, true)] : phase === 2 ? [btn(k.aussen, 3, false), btn(k.zurueck, 1, true)] : [btn(k.innen, 2, false), btn(k.zurueck, 1, true)];
  const foot = phase === 2 ? d.fuss_fern : phase === 3 ? d.fuss_aussen : null;

  return (
    <div
      ref={(el) => {
        scrollEl.current = el;
        seenRef(el);
      }}
      data-orbits-scroll=""
      className="w-full"
      style={{ height: still ? undefined : `${SCROLL_VH}vh` }}
    >
      <div
        ref={stick}
        className={`${still ? "relative" : "sticky"} flex flex-col pb-4 pt-4 max-md:overflow-hidden`}
        style={{ top: still ? undefined : "var(--header-h)", height: "calc(100svh - var(--header-h))", minHeight: 420 }}
      >
        <p className="mb-2 min-h-[2.5em] font-display text-[clamp(1.2rem,2vw,1.625rem)] font-semibold leading-tight">{phase <= 1 ? d.titel : phase === 2 ? d.titel_fern : d.titel_aussen}</p>
        <div ref={slot} className="relative min-h-0 flex-1">
          <div className="absolute left-1/2 top-1/2 max-md:top-[40%]" style={{ width: W, height: H, transform: "translate(-50%, -50%) scale(var(--k))" }}>
            {d.geschaeft && <SolarSystem g={d.geschaeft} t={t} kern={kern} d0={OUT_D} cx={CX} cy={CY} active={phase === 3} />}

            {/* Orbit-Teilbühne: Erde mit Bahnen; Skalierung und Lage aus dem Scroll (--s, --y), Bahnen schrumpfen in C (--rs, --ro). */}
            <div
              className="pointer-events-none absolute top-0 z-[1]"
              style={{
                left: shift ? 0 : 258,
                width: 780,
                height: 620,
                transform: "translateY(calc(var(--y) * 1px)) scale(var(--s))",
                transformOrigin: "390px 310px",
                transition: "left .8s cubic-bezier(.65,0,.35,1)",
              }}
            >
              <div className="absolute inset-0" style={{ opacity: "var(--ro)", transform: "scale(var(--rs))", transformOrigin: "390px 310px" }}>
                {layer(false)}
              </div>
              {seen && (
                <div
                  className="absolute z-[2]"
                  style={{
                    left: 390 - GLOBE_BOX / 2,
                    top: 310 - GLOBE_BOX / 2,
                    width: GLOBE_BOX,
                    height: GLOBE_BOX,
                    transform: `scale(${GLOBE_FIT})`,
                    pointerEvents: fine && (phase === 1 || phase === 2) ? "auto" : "none",
                  }}
                >
                  <Globe view={VIEW} />
                </div>
              )}
              <div className="absolute inset-0 z-[3]" style={{ opacity: "var(--ro)", transform: "scale(var(--rs))", transformOrigin: "390px 310px" }}>
                {layer(true)}
                <div inert={phase !== 1} className="pointer-events-none absolute inset-0 z-[4]">
                  {d.bahnen.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setPick(r.id)}
                      className={`pointer-events-auto absolute min-h-8 whitespace-nowrap border bg-night/80 px-2 py-0.5 text-[14px] ${r.id === "sso" ? "border-red font-semibold text-white" : r.id === "polar" ? "border-rule text-ice" : "border-rule text-mist"}`}
                      style={{ left: r.lx, top: r.ly, ...labScale("0 0") }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nukleus: rotes Glühen um die Erde und Beschriftung, beide unskaliert über --s positioniert. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-[2] rounded-full"
              style={{
                left: `calc(${CX}px - ${R}px * var(--s))`,
                top: `calc(310px + var(--y) * 1px - ${R}px * var(--s))`,
                width: `calc(${2 * R}px * var(--s))`,
                height: `calc(${2 * R}px * var(--s))`,
                opacity: "var(--glow)",
                boxShadow: GLOW,
              }}
            />
            <div
              className="pointer-events-none absolute z-[3] flex flex-col items-center gap-0.5 whitespace-nowrap bg-night/80 px-3 py-1.5 text-center font-semibold leading-[1.15]"
              style={{
                left: CX,
                top: `calc(310px + var(--y) * 1px + ${R}px * var(--s) + 14px)`,
                fontSize: NUC_FS,
                opacity: "var(--nl)",
                transform: "translateX(-50%) scale(calc(var(--ns) * var(--lab)))",
                transformOrigin: "50% 0",
              }}
            >
              <span>{d.geschaeft?.kern}</span>
              <span className="font-mono text-[0.65em] font-medium text-ice">{usd(kern)}</span>
            </div>

            {phase === 1 && !o && !mobile && (
              <span className="absolute left-0 top-0 text-[15px] text-mist" style={labScale("0 0")}>
                {d.hinweis}
              </span>
            )}
            {o && !mobile && <div className="panel-in absolute right-0 top-0 z-[5] flex w-[470px] flex-col gap-4">{panel}</div>}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3">
            <div className="pointer-events-auto flex flex-col items-start gap-2 self-start">{buttons}</div>
            {foot && <div className="border-t border-rule bg-night/80 pt-3 text-[14px] leading-snug text-mist md:text-[15px]">{foot}</div>}
          </div>
          {o && mobile && <div className="panel-in absolute inset-x-0 bottom-0 z-20 flex max-h-[75%] flex-col gap-3 overflow-y-auto bg-night p-1">{panel}</div>}
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
