"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ConfigFile, Manifest, RunsFile, ScenarioId } from "@/lib/contract";
import { useJSON } from "@/lib/data";
import { findRun, headlineRun, selectionQuery, useSelection } from "@/lib/selection";
import { buildTables, useLiveJSON, type SitesCompare, type Story, type Tables } from "@/lib/story";
import { SCENARIO_FALLBACK } from "@/lib/labels";
import { ErrorState } from "@/components/ui/States";
import { StoryChapters, Tokens } from "@/components/story/StoryChapters";
import { ChapterRail } from "@/components/story/ChapterRail";
import { WeltmarktHero } from "@/components/flow/WeltmarktHero";
import { ProduktionHero } from "@/components/flow/ProduktionHero";
import { OrbitFlight } from "@/components/flow/DeepDiveScene";
import type { FlowData } from "@/components/flow/shared";

/**
 * Startseite: Hero und Einstieg „Weltmarkt“ (Skizze Flow) über den Kapiteln. hero="andoya" zeigt stattdessen die Kamerafahrt
 * zum Pad (/alt/). Die Deep-Dive-Seiten je Startplatz liegen unter app/deepdive/.
 */
export function HomeView({ hero = "weltmarkt" }: { hero?: "weltmarkt" | "andoya" }) {
  const manifest = useJSON<Manifest>("manifest.json");
  const runs = useJSON<RunsFile>("runs.json");
  const config = useJSON<ConfigFile>("config.json");
  // Story, Case-DB und Standortvergleich immer frisch: Text- und Zahlenänderungen gelten ohne Neubau (?live: ohne Neuladen).
  const story = useLiveJSON<Story>("data/story.json");
  const db = useLiveJSON<Tables>("data/isar/isar_data.json");
  const sites = useLiveJSON<SitesCompare>("data/sites/sites_compare.json");
  const flow = useLiveJSON<FlowData>("data/flow.json");
  const { selection } = useSelection(manifest.state === "ready" ? manifest.data : undefined);
  const q = selectionQuery(selection);

  const base = runs.state === "ready" ? headlineRun(runs.data.runs, manifest.state === "ready" ? manifest.data : undefined) : undefined;
  const current = runs.state === "ready" ? findRun(runs.data.runs, selection) : undefined;
  const labels = ((config.state === "ready" ? config.data.scenario_labels?.value : undefined) ?? SCENARIO_FALLBACK) as Record<ScenarioId, string>;

  const t = useMemo(
    () => buildTables(db.state === "ready" ? db.data : {}, sites.state === "ready" ? sites.data : undefined),
    [db, sites],
  );
  const s = story.state === "ready" ? story.data : null;
  const rail = useMemo(
    () => (s ? [...(hero === "weltmarkt" ? [{ id: "start", nav: "Start" }] : []), { id: "einstieg", nav: s.hero.nav }, ...s.chapters.map((c) => ({ id: c.id, nav: c.nav }))] : []),
    [s, hero],
  );
  const dataReady = db.state === "ready" && sites.state === "ready";
  const loadErr = [story, db, sites, flow].find((x) => x.state === "error");

  return (
    <>
      {hero === "andoya" ? (
        <Hero hero={s && dataReady ? s.hero : null} t={t} query={q} />
      ) : flow.state === "ready" && dataReady ? (
        <>
          <ProduktionHero d={flow.data.hero} />
          <WeltmarktHero d={flow.data.weltmarkt} t={t} />
        </>
      ) : (
        <section id="einstieg" aria-busy="true" className="h-[calc(100svh-var(--header-h))] min-h-[640px]" />
      )}
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
              flow: flow.state === "ready" ? flow.data : undefined,
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

/** Einstieg mit der Kamerafahrt zum Andøya-Pad (/alt/): Leitfrage links, Fahrt rechts. */
function Hero({ hero, t, query }: { hero: Story["hero"] | null; t: Tables; query: string }) {
  return (
    <section id="einstieg" aria-labelledby="leitfrage" className="relative isolate h-[calc(100svh-var(--header-h))] min-h-[600px] overflow-hidden bg-[radial-gradient(120%_90%_at_70%_40%,#13203a_0%,#0b1220_55%,#070c16_100%)]">
      <OrbitFlight
        focusX={0.64}
        actions={
          <Link href={`/analyse/${query}`} className="bg-ice px-3.5 py-2 text-[0.88rem] font-medium text-night no-underline hover:bg-snow">
            Go to analysis
          </Link>
        }
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,18,32,0.82)_0%,rgba(11,18,32,0.45)_38%,rgba(11,18,32,0)_62%)] max-md:bg-[linear-gradient(0deg,rgba(11,18,32,0.94)_0%,rgba(11,18,32,0.5)_45%,rgba(11,18,32,0)_70%)]" />
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
      </OrbitFlight>
    </section>
  );
}
