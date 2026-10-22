"use client";

import type { Manifest, RunsFile, TimelineFile } from "@/lib/contract";
import { dataURL, useJSON } from "@/lib/data";
import { findRun, useSelection, selectionQuery } from "@/lib/selection";
import { SCOPE_LABELS } from "@/lib/labels";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { RunControls } from "@/components/ui/RunControls";
import { toCSV } from "@/lib/csv";

export function ExportView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const runs = useJSON<RunsFile>("runs.json");
  const timeline = useJSON<TimelineFile>("timeline.json");
  return <Ready items={[manifest, runs, timeline] as const}>{(m, r, t) => <Export manifest={m} runs={r} timeline={t} />}</Ready>;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Export({ manifest, runs, timeline }: { manifest: Manifest; runs: RunsFile; timeline: TimelineFile }) {
  const { selection } = useSelection(manifest);
  const run = findRun(runs.runs, selection);
  const tl = timeline.by_scope[selection.scope];
  const tag = runs.provenance.status === "fixture" ? "fixture" : "lieferung";

  return (
    <>
      <PageHead title="Export">
        Die Daten des aktiven Runs so, wie die Oberfläche sie anzeigt. Die Dateien serialisieren gelieferte Werte; berechnet wird hier nichts.
      </PageHead>
      <div className="border-y border-rule/70 bg-night/92 lg:sticky lg:top-[var(--header-h)] lg:z-30 lg:backdrop-blur-md">
        <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-8">
          <RunControls manifest={manifest} />
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 pt-6 sm:px-8">
        <ProvenanceNote p={runs.provenance} />
      </div>

      <Section id="dateien" title="Dateien">
        <ul className="divide-y divide-rule border-y border-rule">
          <ExportRow
            title={`Run ${run?.run_id ?? "–"} als JSON`}
            text={`Stufen, Ausschlussgründe, E3, Verticals und Herkunft für ${SCOPE_LABELS[selection.scope]}, ${selection.year}.`}
            disabled={!run}
            onClick={() => run && download(`andoya_${run.run_id}_${tag}.json`, JSON.stringify({ provenance: runs.provenance, run }, null, 2), "application/json")}
          />
          <ExportRow
            title={`Zeitachse ${SCOPE_LABELS[selection.scope]} als CSV`}
            text="Alle Jahre und Szenarien, Spalten wie engine.timeline (Langformat). Trennzeichen Semikolon, Dezimalpunkt."
            disabled={!tl}
            onClick={() => tl && download(`zeitachse_andoya_${selection.scope}_${tag}.csv`, toCSV(tl.rows as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8")}
          />
          <li className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-snow">Gesamter Datensatz der Oberfläche</p>
              <p className="text-[0.92rem] text-mist">Die JSON-Dateien, die diese Seite lädt, unverändert.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {manifest.files.map((f) => (
                <a key={f} href={dataURL(f, selectionQuery(selection))} download className="border border-rule-strong px-2.5 py-1 text-[0.85rem] no-underline hover:border-ice">
                  {f}
                </a>
              ))}
            </div>
          </li>
        </ul>
      </Section>

      <Section id="bericht" title="Fachlicher Bericht">
        <OpenItem title="Markdown-Bericht mit Belegen je Kennzahl">
          Den Bericht erzeugt bisher die Streamlit-App (Seite 5) aus dem Rechenkern. Für die Weboberfläche ist er als fachliches Exportartefakt
          angefragt (INTEGRATION_REQUESTS.md, IR-07); die Oberfläche bietet ihn dann hier zum Download an.
        </OpenItem>
      </Section>
    </>
  );
}

function ExportRow({ title, text, onClick, disabled }: { title: string; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-snow">{title}</p>
        <p className="text-[0.92rem] text-mist">{text}</p>
      </div>
      <button type="button" onClick={onClick} disabled={disabled} className="justify-self-start bg-ice px-4 py-2 text-[0.92rem] font-medium text-night hover:bg-snow disabled:opacity-40">
        Herunterladen
      </button>
    </li>
  );
}
