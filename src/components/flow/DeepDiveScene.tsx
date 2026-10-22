"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConfigFile, Leaf } from "@/lib/contract";
import { useAssetJSON, useJSON } from "@/lib/data";
import type { GeoManifest, Phase, SceneHandle } from "@/components/scene/OrbitScene";
import { PadMap } from "@/components/scene/PadMap";
import type { PinPos, View } from "./Globe";
import { coord, OVERVIEW } from "./DeepDiveFacts";

const OrbitScene = dynamic(() => import("@/components/scene/OrbitScene").then((m) => m.OrbitScene), { ssr: false });
const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

// Deep Dive ohne Sentinel-Kacheln: Globus bis über den Platz (Erdradien vom Erdmittelpunkt). Näher als rund 1,3 wird die
// Globus-Textur pixelig und die Küste unkenntlich.
const DIVE_DIST = 1.3;

const PHASE_LABEL: Record<Phase, string> = {
  loading: "Loading maps",
  erde: "Earth",
  nordeuropa: "Northern Europe",
  nordnorwegen: "Northern Norway, Vesterålen",
  andoya: "Andøya",
  pad: "Andøya Spaceport, Pad A",
};

const BTN = "border border-rule-strong bg-night/60 px-3 py-2 text-[0.88rem] text-snow backdrop-blur-sm hover:border-ice";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Karten, OSM-Geometrie und genehmigter Startsektor für die Andøya-Fahrt (geo/, config.json). */
function useAndoyaScene() {
  const config = useJSON<ConfigFile>("config.json");
  const g = useAssetJSON<GeoManifest>("geo/manifest.json");
  const o = useAssetJSON<{ features: [] }>("geo/pad_osm.json");
  const site = config.state === "ready" ? config.data.sites?.andoya : undefined;
  const sector = (site?.sector_deg as Leaf<{ min: number; max: number }> | undefined)?.value ?? null;
  const incWindow = site?.inc_min?.value != null && site?.inc_max?.value != null ? `${site.inc_min.value}–${site.inc_max.value}°` : null;
  const loadError =
    (g.state === "error" ? g.error : o.state === "error" ? o.error : null) ??
    (config.state === "error" ? config.error : null) ??
    (config.state === "ready" && !sector ? "Launch sector not supplied in config.json" : null);
  const geo = g.state === "ready" && o.state === "ready" ? { manifest: g.data, osm: o.data } : null;
  return { geo, sector, incWindow, loadError };
}

/**
 * Kamerafahrt zum Andøya-Pad (OrbitScene: Sentinel-2-Kacheln, OSM, Startsektor) mit Beschriftungen, Überspringen/Wiederholen,
 * Phase und Quellen. Füllt den nächsten positionierten Kasten; children liegen über der Szene (z. B. Hero-Text).
 */
export function OrbitFlight({
  focusX = 0.5,
  padLabel = "Pad A",
  actions,
  children,
}: {
  focusX?: number;
  padLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const { geo, sector, incWindow, loadError } = useAndoyaScene();
  const scene = useRef<SceneHandle>(null);
  // Überspringen-Wunsch merken: das Szenenmodul lädt nach, ein früher Klick darf nicht verloren gehen.
  const [skipReq, setSkipReq] = useState(false);
  const skip = () => {
    setSkipReq(true);
    scene.current?.skip();
  };
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [labelPos, setLabelPos] = useState<{ pad?: [number, number]; sector?: [number, number]; visible: number }>({ visible: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !arrived) skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arrived]);

  const ready = geo && sector;

  return (
    <>
      {ready && !failed && (
        <OrbitScene
          handle={scene}
          skipped={skipReq}
          geo={geo.manifest}
          osm={geo.osm}
          sector={sector}
          reducedMotion={reduced}
          focusX={focusX}
          onPhase={setPhase}
          onProgress={setProgress}
          onArrive={() => setArrived(true)}
          onFail={setFailed}
          onLabels={setLabelPos}
        />
      )}
      {ready && failed && (
        <div className="absolute inset-0 flex items-center justify-end [mask-image:linear-gradient(90deg,transparent_0%,#000_45%)]">
          <PadMap geo={geo.manifest} osm={geo.osm} sector={sector} className="aspect-square h-full max-w-none opacity-90" showScale={false} caption={false} />
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,32,0.62)_0%,rgba(11,18,32,0.28)_26%,rgba(11,18,32,0)_50%)] transition-opacity duration-[1600ms]"
        style={{ opacity: phase === "pad" || phase === "andoya" ? 1 : 0 }}
      />
      {/* Beschriftungen am Pad, projiziert aus der Szene */}
      {!failed && labelPos.pad && labelPos.visible > 0.05 && (
        <div className="pointer-events-none absolute inset-0" style={{ opacity: labelPos.visible }} aria-hidden="true">
          <span className="absolute -translate-y-full whitespace-nowrap pb-3 text-[0.82rem] text-snow" style={{ left: labelPos.pad[0] + 10, top: labelPos.pad[1] }}>
            {padLabel}
          </span>
          {labelPos.sector && sector && (
            <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[0.82rem] text-aurora" style={{ left: labelPos.sector[0], top: labelPos.sector[1] }}>
              Launch sector {sector.min}–{sector.max}° <span className="text-mist">(licence, radius schematic)</span>
              {incWindow && <span className="block text-center text-mist">Inclination window {incWindow}</span>}
            </span>
          )}
        </div>
      )}

      {children}

      <div className="absolute right-4 top-4 flex gap-2 sm:right-8 sm:top-6">
        {!arrived && !failed && ready && (
          <button type="button" onClick={skip} className={BTN}>
            Skip flight
          </button>
        )}
        {arrived && !reduced && !failed && (
          <button
            type="button"
            onClick={() => {
              setArrived(false);
              setSkipReq(false);
              scene.current?.replay();
            }}
            className={BTN}
          >
            Replay flight
          </button>
        )}
        {actions}
      </div>

      <div className="absolute bottom-10 right-4 hidden text-right sm:right-8 sm:bottom-14 md:block" aria-live="polite">
        <p className="text-[0.9rem] text-snow">{loadError ? "Map not available" : failed ? "Site plan (static)" : PHASE_LABEL[phase]}</p>
        {loadError && <p className="mt-1 text-[0.8rem] text-alert">{loadError}</p>}
        {geo && (
          <p className="metric mt-1 text-mist">
            {coord(geo.manifest.pad.lat, geo.manifest.pad.lon)} · ±{geo.manifest.pad.accuracy_m} m
          </p>
        )}
        {failed && <p className="mt-1 text-[0.8rem] text-mist">{failed}; static site plan from the same data</p>}
      </div>

      <p className="absolute inset-x-4 bottom-2.5 text-[0.7rem] leading-snug text-mist sm:left-auto sm:right-8 sm:text-right">
        Image: NASA Earth Observatory · contains modified Copernicus Sentinel data 2025 · Map © OpenStreetMap contributors
      </p>

      {!failed && (
        <div className="absolute inset-x-0 bottom-0 h-px bg-rule/60" aria-hidden="true">
          <div className="h-px bg-ice transition-[width] duration-150" style={{ width: `${(arrived ? 1 : progress) * 100}%`, opacity: arrived ? 0 : 1 }} />
        </div>
      )}
    </>
  );
}

/**
 * Deep Dive ohne Sentinel-Kacheln: 3D-Globus fährt von der Übersicht bis dicht über den Platz, Pad mit Puls.
 * Füllt den nächsten positionierten Kasten; „Replay“ baut den Globus neu auf und startet die Fahrt erneut.
 */
export function GlobeFlight({ id, name, lat, lon, hint }: { id: string; name: string; lat: number; lon: number; hint: string }) {
  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const [run, setRun] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const pinList = useMemo(() => [{ id, lat, lon }], [id, lat, lon]);
  const view = useMemo<View>(() => ({ lat, lon, dist: DIVE_DIST }), [lat, lon]);
  const p = pins[id];

  return (
    <>
      <Globe key={run} view={view} from={OVERVIEW} pins={pinList} onPins={setPins} onFail={setFailed} />
      {p?.front && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="pad" style={{ left: p.x, top: p.y }}>
            <span className="pulse" />
            <span className="dot" />
          </span>
          <span className="plabel" style={{ left: p.x, top: p.y, transform: "translate(20px, -50%)" }}>
            {name} · Pad
          </span>
        </div>
      )}
      <span className="absolute left-3.5 top-3.5 max-w-[calc(100%-9rem)] border border-dashed border-amber bg-night/85 px-2 py-1 font-mono text-[12px] leading-snug text-amber">
        {hint}
      </span>
      <div className="absolute right-3.5 top-3.5">
        <button type="button" onClick={() => setRun((r) => r + 1)} className={BTN}>
          Replay flight
        </button>
      </div>
      <div className="absolute bottom-3.5 left-4 flex flex-col gap-1" aria-live="polite">
        {failed && <span className="text-[0.8rem] text-alert">{failed}</span>}
        <span className="metric bg-night/80 px-2 py-0.5 text-mist">{coord(lat, lon)}</span>
      </div>
      <span className="absolute bottom-3.5 right-3 bg-night/70 px-1.5 py-0.5 text-[0.7rem] text-mist">Image: NASA Earth Observatory</span>
    </>
  );
}
