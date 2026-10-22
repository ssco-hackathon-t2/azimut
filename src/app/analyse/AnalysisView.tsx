"use client";

import Link from "next/link";
import type { ConfigFile, Manifest, RunsFile, ScenarioId, TimelineFile } from "@/lib/contract";
import { useJSON } from "@/lib/data";
import { belegeHref, findRun, headlineRun, useSelection } from "@/lib/selection";
import { SCENARIO_FALLBACK, SCOPE_LABELS, STAGE_LABELS } from "@/lib/labels";
import { fmtEurMio, fmtNum, fmtPct, fmtT } from "@/lib/format";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { RunControls } from "@/components/ui/RunControls";
import { KeyStatement } from "@/components/analysis/KeyStatement";
import { FunnelWaterfall } from "@/components/charts/FunnelWaterfall";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { ScenarioCompare } from "@/components/charts/ScenarioCompare";
import { VerticalBars } from "@/components/charts/VerticalBars";

export function AnalysisView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const runs = useJSON<RunsFile>("runs.json");
  const timeline = useJSON<TimelineFile>("timeline.json");
  const config = useJSON<ConfigFile>("config.json");
  return (
    <Ready items={[manifest, runs, timeline, config] as const}>
      {(m, r, t, c) => <Analysis manifest={m} runs={r} timeline={t} config={c} />}
    </Ready>
  );
}

function Analysis({ manifest, runs, timeline, config }: { manifest: Manifest; runs: RunsFile; timeline: TimelineFile; config: ConfigFile }) {
  const { selection } = useSelection(manifest);
  const run = findRun(runs.runs, selection);
  const base = headlineRun(runs.runs, manifest);
  const labels = (config.scenario_labels?.value ?? SCENARIO_FALLBACK) as Record<ScenarioId, string>;
  const verticalLabels = ((config.verticals as { labels?: { value?: Record<string, string> } } | undefined)?.labels?.value ?? {}) as Record<string, string>;
  if (!run || !base) {
    // Fehlender Run: Steuerung bleibt bedienbar, damit eine andere Kombination wählbar ist.
    return (
      <>
        <PageHead title="Analyse" />
        <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
          <RunControls manifest={manifest} config={config} />
          <div className="mt-8">
            <OpenItem title={`Kein vorbereiteter Run für ${labels[selection.scenario] ?? selection.scenario}, ${selection.year}, ${SCOPE_LABELS[selection.scope]}`}>
              {!base ? "Auch der Headline-Run (Basisjahr, alle Nutzlasten) fehlt im Datensatz. " : ""}Bitte eine andere Kombination wählen; der Fachlauf
              liefert nur das Raster aus manifest.json.
            </OpenItem>
          </div>
        </div>
      </>
    );
  }
  const sameYearScope = runs.runs.filter((x) => x.params.year === run.params.year && x.params.scope === run.params.scope && x.params.site_id === run.params.site_id);
  const st = Object.fromEntries(run.stages.map((s) => [s.name, s]));
  const tl = timeline.by_scope[run.params.scope];

  return (
    <>
      <PageHead title="Analyse">
        Trichter von der globalen Nachfrage (E0) bis zum gewinnbaren Anteil (E3) für den gewählten Run. Alle Ansichten zeigen denselben
        aktiven Run.
      </PageHead>

      <div className="border-y border-rule/70 bg-night/92 lg:sticky lg:top-[var(--header-h)] lg:z-30 lg:backdrop-blur-md">
        <div className="mx-auto flex max-w-[88rem] flex-col gap-3 px-4 py-4 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
          <RunControls manifest={manifest} config={config} />
          <p className="text-[0.82rem] text-mist">
            Aktiver Run <span className="metric text-snow">{run.run_id}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 pt-6 sm:px-8">
        <ProvenanceNote p={runs.provenance} />
      </div>

      <Section id="ergebnis" title="Ergebnis">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <KeyStatement base={base} current={run} scenarioLabels={labels} size="md" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 self-start border-l border-rule pl-6 text-[0.95rem]">
            {(["E0", "E1", "E2", "E3"] as const).map((s) => (
              <div key={s}>
                <dt className="text-[0.82rem] text-mist">{STAGE_LABELS[s]}</dt>
                <dd className="num mt-0.5">
                  <Link href={belegeHref(`${s.toLowerCase()}_mass`, selection)} className={`no-underline hover:underline ${s === "E3" ? "text-aurora" : "text-snow"}`}>
                    {fmtT(st[s].mass_kg)}
                  </Link>
                  <span className="ml-2 text-mist">{fmtPct(st[s].share_mass, 2)}</span>
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-[0.82rem] text-mist">Missionen/Jahr ({run.params.year})</dt>
              <dd className="num mt-0.5">
                {fmtNum(run.e3.missions_served, 1)} <span className="text-mist">von {fmtNum(run.e3.missions_demanded, 1)} nachgefragt</span>
              </dd>
            </div>
            <div>
              <dt className="text-[0.82rem] text-mist">Umsatz E3</dt>
              <dd className="num mt-0.5">{fmtEurMio(run.e3.revenue_eur)}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-6 text-[0.85rem] text-mist">
          Satz 1–2: Basisjahr 2025, alle Nutzlasten (Headline). Satz 3 und Kennzahlen rechts: aktiver Run ({SCOPE_LABELS[run.params.scope]},{" "}
          {run.basis.label}
          {run.params.year > 2025 ? `, Szenario-Jahr ${run.params.year}` : ""}).
        </p>
      </Section>

      <Section
        id="trichter"
        title="Trichter E0 → E3"
        intro="Jeder Satellit fällt am ersten zutreffenden Filter heraus und trägt genau einen Ausschlussgrund. Die grauen Balken sind diese Gründe, die farbigen die verbleibenden Stufen."
      >
        <FunnelWaterfall run={run} />
      </Section>

      <Section
        id="zeitachse"
        title={tl?.rows.length ? `Zeitachse ${Math.min(...tl.rows.map((r) => r.year))}–${Math.max(...tl.rows.map((r) => r.year))}` : "Zeitachse"}
        intro="Szenario gewählt, Band über alle drei vorbereiteten Szenarien. Anteil = E2 / fortgeschriebenes E0 (Szenario, keine Prognose)."
      >
        {tl?.rows.length ? (
          <TimelineChart rows={tl.rows} scenario={run.params.scenario} scenarioLabels={labels} highlightYear={run.params.year} />
        ) : (
          <OpenItem title="Zeitachse für diesen Scope">Im Datensatz ist keine Zeitachse für diesen Scope geliefert.</OpenItem>
        )}
      </Section>

      <Section id="szenarien" title={`Szenarien im Vergleich, ${run.params.year}`} intro={`Vorbereitete Szenarien, ${SCOPE_LABELS[run.params.scope]}. Freie Parameteränderungen gibt es erst mit einer Rechenschnittstelle.`}>
        <ScenarioCompare runs={sameYearScope} active={run.params.scenario} labels={labels} />
      </Section>

      <Section id="verticals" title="Geschäftsfelder (Verticals)" intro="Aufteilung je Stufe aus dem Rechenkern. Die Auswertung je Vertical × Staatengruppe aus dem Fachlauf ist noch nicht geliefert.">
        <VerticalBars run={run} labels={verticalLabels} />
      </Section>
    </>
  );
}
