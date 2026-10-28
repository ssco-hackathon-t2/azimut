"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AssumptionsFile, Run, TracesFile } from "@/lib/contract";
import { useJSON } from "@/lib/data";
import { fmtNum, fmtRaw, fmtValue, urlOf } from "@/lib/format";
import { belegeHref, runId, selectionOf } from "@/lib/selection";
import { Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";

/**
 * Beleg-Karte im Top-Layer (native Popover-API, keine Bibliothek): Wert, Formel, Eingangszahlen,
 * Annahmen mit Quelle und Vergleichswerte einer Kennzahl. Die volle Ansicht bleibt /belege.
 * Die Belege werden erst beim Öffnen geladen; Esc und Klick daneben schließen.
 */
export function EvidenceCard({ id, kpi, run }: { id: string; kpi: string; run: Run }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) close.current?.focus();
    };
    el?.addEventListener("toggle", onToggle);
    return () => el?.removeEventListener("toggle", onToggle);
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      role="dialog"
      aria-labelledby={`${id}-h`}
      // m-auto: Preflight setzt margin auf 0 und hebt damit die Zentrierung des Popovers im Top-Layer auf.
      className="m-auto max-h-[min(86vh,46rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto border border-rule-strong bg-night-2 p-0 text-[1rem] leading-normal font-normal text-snow backdrop:bg-night/70"
    >
      <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-3">
        <p id={`${id}-h`} className="text-[0.86rem] text-mist">
          Where does this number come from?
        </p>
        <button ref={close} type="button" popoverTarget={id} popoverTargetAction="hide" className="-my-1 border border-rule px-2.5 py-1 text-[0.86rem] text-snow hover:border-ice">
          Close
        </button>
      </div>
      {open && <CardBody kpi={kpi} run={run} />}
    </div>
  );
}

function CardBody({ kpi, run }: { kpi: string; run: Run }) {
  const traces = useJSON<TracesFile>("traces.json");
  const assumptions = useJSON<AssumptionsFile>("assumptions.json");
  return (
    <div className="px-5 pb-5">
      <Ready items={[traces, assumptions] as const}>{(t, a) => <Body kpi={kpi} run={run} traces={t} assumptions={a} />}</Ready>
    </div>
  );
}

function Body({ kpi, run, traces, assumptions }: { kpi: string; run: Run; traces: TracesFile; assumptions: AssumptionsFile }) {
  const sel = selectionOf(run);
  // Wie /belege: fehlen Belege im gewählten Scope, Rückfall auf „alle Nutzlasten“, sichtbar gekennzeichnet.
  const fallback = !traces.traces[runId(sel)]?.[kpi];
  const t = traces.traces[runId(fallback ? { ...sel, scope: "all_payloads" } : sel)]?.[kpi];
  const rows = new Map(assumptions.rows.map((r) => [r.key, r]));
  if (!t) return <p className="pt-4 text-mist">No evidence for this metric in the delivered dataset.</p>;

  return (
    <>
      <p className="pt-4 text-[1.05rem] text-snow">{t.label}</p>
      <p className="num mt-1 text-[2rem] font-semibold leading-tight text-snow">{fmtValue(t.value, t.unit)}</p>
      {fallback && <p className="mt-1 text-[0.88rem] text-amber">No evidence for this scope; showing “all payloads” for the same scenario and year.</p>}

      <h3 className="mt-5 text-[0.86rem] font-medium text-mist">Formula</h3>
      <pre className="mt-1.5 whitespace-pre-wrap border border-rule bg-night px-3 py-2 font-mono text-[0.8rem] text-snow">{t.formula}</pre>
      {Object.keys(t.inputs).length > 0 && (
        <table className="num mt-3 w-full border-collapse text-left text-[0.9rem]">
          <tbody>
            {Object.entries(t.inputs).map(([k, v]) => (
              <tr key={k} className="border-b border-rule/50">
                <td className="py-1 pr-4 text-mist">{k}</td>
                <td className="py-1 text-right text-snow">{typeof v === "number" ? fmtNum(v, Math.abs(v) < 10 && !Number.isInteger(v) ? 4 : Number.isInteger(v) ? 0 : 2) : v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-5 text-[0.86rem] font-medium text-mist">Assumptions</h3>
      {t.assumption_keys.length === 0 ? (
        <p className="mt-1.5 text-[0.9rem] text-mist">No YAML assumption feeds into this metric.</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-rule/50 border-y border-rule/70 text-[0.9rem]">
          {t.assumption_keys.map((k) => {
            const r = rows.get(k);
            const team = r?.source?.includes("Team-Annahme");
            const u = r?.source ? urlOf(r.source) : undefined;
            return (
              <li key={k} className="grid gap-0.5 py-2">
                <span className="metric text-snow">{k}</span>
                <span className="break-words text-snow">
                  {r ? fmtRaw(r.value, r.unit) : "–"} {r?.unit}
                </span>
                <span className="text-[0.84rem] text-mist">
                  {team && (
                    <span className="mr-2 inline-flex items-center gap-1.5 text-alert">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-alert" />
                      Team assumption
                    </span>
                  )}
                  {team && r?.source?.trim() === "Team-Annahme" ? null : u ? <a href={u}>{new URL(u).hostname}</a> : (r?.source ?? "–")}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {t.references.length > 0 && (
        <>
          <h3 className="mt-5 text-[0.86rem] font-medium text-mist">Benchmarks</h3>
          <ul className="mt-1.5 divide-y divide-rule/50 border-y border-rule/70 text-[0.9rem]">
            {t.references.map((r) => (
              <li key={r.key} className="grid gap-0.5 py-2">
                <span className="text-snow">
                  {r.key}: {fmtRaw(r.value, r.unit)} {r.unit} {r.year ? `(${r.year})` : ""}
                </span>
                {r.note && <span className="text-[0.84rem] text-mist">{r.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
        <ProvenanceNote p={traces.provenance} compact />
        <Link href={belegeHref(kpi, sel)} className="text-[0.9rem]">
          All details
        </Link>
      </div>
    </>
  );
}
