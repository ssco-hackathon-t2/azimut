"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfigFile, Leaf, Manifest, RunsFile, ScenarioId } from "@/lib/contract";
import { useAssetJSON, useJSON } from "@/lib/data";
import { findRun, headlineRun, selectionQuery, useSelection } from "@/lib/selection";
import { buildTables, useLiveJSON, type SitesCompare, type Story, type Tables } from "@/lib/story";
import { SCENARIO_FALLBACK } from "@/lib/labels";
import { fmtCoord } from "@/lib/format";
import { ErrorState } from "@/components/ui/States";
import { StoryChapters, Tokens } from "@/components/story/StoryChapters";
import { ChapterRail } from "@/components/story/ChapterRail";
import type { GeoManifest, Phase, SceneHandle } from "@/components/scene/OrbitScene";
import { PadMap } from "@/components/scene/PadMap";

const OrbitScene = dynamic(() => import("@/components/scene/OrbitScene").then((m) => m.OrbitScene), { ssr: false });

const PHASE_LABEL: Record<Phase, string> = {
  loading: "Karten werden geladen",
  erde: "Erde",
  nordeuropa: "Nordeuropa",
  nordnorwegen: "Nordnorwegen, Vesterålen",
  andoya: "Andøya",
  pad: "Andøya Spaceport, Pad A",
};

export function HomeView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const runs = useJSON<RunsFile>("runs.json");
  const config = useJSON<ConfigFile>("config.json");
  // Story, Case-DB und Standortvergleich immer frisch: Text- und Zahlenänderungen gelten ohne Neubau (?live: ohne Neuladen).
  const story = useLiveJSON<Story>("data/story.json");
  const db = useLiveJSON<Tables>("data/isar/isar_data.json");
  const sites = useLiveJSON<SitesCompare>("data/sites/sites_compare.json");
  const geo = useGeo();
  const { selection } = useSelection(manifest.state === "ready" ? manifest.data : undefined);
  const q = selectionQuery(selection);

  const base = runs.state === "ready" ? headlineRun(runs.data.runs, manifest.state === "ready" ? manifest.data : undefined) : undefined;
  const current = runs.state === "ready" ? findRun(runs.data.runs, selection) : undefined;
  const labels = ((config.state === "ready" ? config.data.scenario_labels?.value : undefined) ?? SCENARIO_FALLBACK) as Record<ScenarioId, string>;
  const sectorLeaf = config.state === "ready" ? (config.data.sites?.andoya?.sector_deg as Leaf<{ min: number; max: number }> | undefined) : undefined;
  const sector = sectorLeaf?.value ?? null;
  const site = config.state === "ready" ? config.data.sites?.andoya : undefined;
  const incWindow = site?.inc_min?.value != null && site?.inc_max?.value != null ? `${site.inc_min.value}–${site.inc_max.value}°` : null;
  const loadError =
    geo.error ?? (config.state === "error" ? config.error : null) ?? (config.state === "ready" && !sector ? "Startsektor in config.json nicht geliefert" : null);

  const t = useMemo(
    () => buildTables(db.state === "ready" ? db.data : {}, sites.state === "ready" ? sites.data : undefined),
    [db, sites],
  );
  const s = story.state === "ready" ? story.data : null;
  const rail = useMemo(() => (s ? [{ id: "einstieg", nav: s.hero.nav }, ...s.chapters.map((c) => ({ id: c.id, nav: c.nav }))] : []), [s]);
  const dataReady = db.state === "ready" && sites.state === "ready";
  const loadErr = [story, db, sites].find((x) => x.state === "error");

  return (
    <>
      <Hero geo={geo.data} loadError={loadError} sector={sector} incWindow={incWindow} hero={s && dataReady ? s.hero : null} t={t} query={q} />
      {s && dataReady && (
        <>
          <StoryChapters
            chapters={s.chapters}
            ctx={{
              t,
              sites: sites.state === "ready" ? sites.data : undefined,
              runs: runs.state === "ready" ? runs.data : undefined,
              base,
              current,
              manifest: manifest.state === "ready" ? manifest.data : undefined,
              config: config.state === "ready" ? config.data : undefined,
              labels,
              query: q,
            }}
          />
          <ChapterRail items={rail} />
        </>
      )}
      {loadErr && loadErr.state === "error" && (
        <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
          <ErrorState error={loadErr.error} retry={loadErr.retry} />
        </div>
      )}
      {runs.state === "error" && (
        <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
          <ErrorState error={runs.error} retry={runs.retry} />
        </div>
      )}
    </>
  );
}

function useGeo() {
  const g = useAssetJSON<GeoManifest>("geo/manifest.json");
  const o = useAssetJSON<{ features: [] }>("geo/pad_osm.json");
  const error = g.state === "error" ? g.error : o.state === "error" ? o.error : null;
  return { data: g.state === "ready" && o.state === "ready" ? { manifest: g.data, osm: o.data } : null, error };
}

type GeoData = { manifest: GeoManifest; osm: { features: [] } } | null;

function Hero({
  geo,
  loadError,
  sector,
  incWindow,
  hero,
  t,
  query,
}: {
  geo: GeoData;
  loadError: string | null;
  sector: { min: number; max: number } | null;
  incWindow?: string | null;
  hero: Story["hero"] | null;
  t: Tables;
  query: string;
}) {
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
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !arrived) skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [arrived]);

  const ready = geo && sector;

  return (
    <section id="einstieg" aria-labelledby="leitfrage" className="relative isolate h-[calc(100svh-var(--header-h))] min-h-[600px] overflow-hidden bg-[radial-gradient(120%_90%_at_70%_40%,#13203a_0%,#0b1220_55%,#070c16_100%)]">
      {ready && !failed && (
        <OrbitScene
          handle={scene}
          skipped={skipReq}
          geo={geo.manifest}
          osm={geo.osm}
          sector={sector}
          reducedMotion={reduced}
          focusX={0.64}
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
            Pad A
          </span>
          {labelPos.sector && sector && (
            <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[0.82rem] text-aurora" style={{ left: labelPos.sector[0], top: labelPos.sector[1] }}>
              Startsektor {sector.min}–{sector.max}° <span className="text-mist">(genehmigt, Radius schematisch)</span>
              {incWindow && <span className="block text-center text-mist">Inklinationsfenster {incWindow}</span>}
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,18,32,0.82)_0%,rgba(11,18,32,0.45)_38%,rgba(11,18,32,0)_62%)] max-md:bg-[linear-gradient(0deg,rgba(11,18,32,0.94)_0%,rgba(11,18,32,0.5)_45%,rgba(11,18,32,0)_70%)]" />

      <div className="absolute right-4 top-4 flex gap-2 sm:right-8 sm:top-6">
        {!arrived && !failed && ready && (
          <button type="button" onClick={skip} className="border border-rule-strong bg-night/60 px-3 py-2 text-[0.88rem] text-snow backdrop-blur-sm hover:border-ice">
            Fahrt überspringen
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
            className="border border-rule-strong bg-night/60 px-3 py-2 text-[0.88rem] text-snow backdrop-blur-sm hover:border-ice"
          >
            Fahrt wiederholen
          </button>
        )}
        <Link href={`/analyse/${query}`} className="bg-ice px-3.5 py-2 text-[0.88rem] font-medium text-night no-underline hover:bg-snow">
          Direkt zur Analyse
        </Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[88rem] px-4 pb-16 sm:px-8 sm:pb-14">
        {hero && (
          <div className="max-w-[44rem]">
            {hero.kicker && <p className="mb-4 text-[0.82rem] uppercase tracking-[0.14em] text-ice">{hero.kicker}</p>}
            <h1 id="leitfrage" className="text-[clamp(1.9rem,4.6vw,3.8rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-snow">
              <Tokens text={hero.title} t={t} />
            </h1>
            {hero.lead && (
              <p className="mt-5 max-w-[60ch] text-[clamp(0.98rem,1.3vw,1.12rem)] leading-relaxed text-mist">
                <Tokens text={hero.lead} t={t} strong />
              </p>
            )}
            {hero.claim && (
              <p className="mt-6 border-l-2 border-aurora pl-4 font-display text-[clamp(1.1rem,1.7vw,1.4rem)] font-semibold text-snow">
                <Tokens text={hero.claim} t={t} />
              </p>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-10 right-4 hidden text-right sm:right-8 sm:bottom-14 md:block" aria-live="polite">
        <p className="text-[0.9rem] text-snow">{loadError ? "Karte nicht verfügbar" : failed ? "Lageplan (statisch)" : PHASE_LABEL[phase]}</p>
        {loadError && <p className="mt-1 text-[0.8rem] text-alert">{loadError}</p>}
        {geo && <p className="metric mt-1 text-mist">{fmtCoord(geo.manifest.pad.lat, geo.manifest.pad.lon, 4)} · ±{geo.manifest.pad.accuracy_m} m</p>}
        {failed && <p className="mt-1 text-[0.8rem] text-mist">{failed}; statischer Lageplan aus denselben Daten</p>}
      </div>

      <p className="absolute inset-x-4 bottom-2.5 text-[0.7rem] leading-snug text-mist sm:left-auto sm:right-8 sm:text-right">
        Bild: NASA Earth Observatory · enthält veränderte Copernicus-Sentinel-Daten 2025 · Karte © OpenStreetMap-Mitwirkende
      </p>

      {!failed && (
        <div className="absolute inset-x-0 bottom-0 h-px bg-rule/60" aria-hidden="true">
          <div className="h-px bg-ice transition-[width] duration-150" style={{ width: `${(arrived ? 1 : progress) * 100}%`, opacity: arrived ? 0 : 1 }} />
        </div>
      )}
    </section>
  );
}
