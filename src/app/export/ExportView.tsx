"use client";

import type { Manifest, RunsFile, TimelineFile } from "@/lib/contract";
import { dataURL, useJSON } from "@/lib/data";
import { findRun, useSelection, selectionQuery } from "@/lib/selection";
import { SCOPE_LABELS } from "@/lib/labels";
import { PageHead, Section } from "@/components/shell/PageHead";
import { Ready } from "@/components/ui/States";
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
  const tag = runs.provenance.status === "fixture" ? "fixture" : "delivery";

  return (
    <>
      <PageHead title="Export" />
      <div className="border-y border-rule/70 bg-night/92 lg:sticky lg:top-[var(--header-h)] lg:z-30 lg:backdrop-blur-md">
        <div className="mx-auto max-w-[88rem] px-4 py-4 sm:px-8">
          <RunControls manifest={manifest} />
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 pt-6 sm:px-8">
        <ProvenanceNote p={runs.provenance} />
      </div>

      <Section id="dateien" title="Files">
        <ul className="divide-y divide-rule border-y border-rule">
          <ExportRow
            title={`Run ${run?.run_id ?? "–"} as JSON`}
            text={`Stages, exclusion reasons, E3, verticals and provenance for ${SCOPE_LABELS[selection.scope]}, ${selection.year}.`}
            disabled={!run}
            onClick={() => run && download(`andoya_${run.run_id}_${tag}.json`, JSON.stringify({ provenance: runs.provenance, run }, null, 2), "application/json")}
          />
          <ExportRow
            title={`Timeline ${SCOPE_LABELS[selection.scope]} as CSV`}
            text="All years and scenarios, columns as in engine.timeline (long format). Semicolon-separated, decimal point."
            disabled={!tl}
            onClick={() => tl && download(`timeline_andoya_${selection.scope}_${tag}.csv`, toCSV(tl.rows as unknown as Record<string, unknown>[]), "text/csv;charset=utf-8")}
          />
          <li className="grid gap-2 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-snow">Full dataset behind this interface</p>
              <p className="text-[0.92rem] text-mist">The JSON files this site loads, unmodified.</p>
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
        Download
      </button>
    </li>
  );
}
