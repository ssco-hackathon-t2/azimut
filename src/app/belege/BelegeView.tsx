"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AssumptionsFile, Manifest, Provenance, Trace, TracesFile } from "@/lib/contract";
import { useAssetJSON, useJSON } from "@/lib/data";
import { fmtDate, fmtNum, fmtRaw, fmtValue, urlOf } from "@/lib/format";
import { SCOPE_LABELS } from "@/lib/labels";
import { runId, useSelection } from "@/lib/selection";
import { PageHead, Section } from "@/components/shell/PageHead";
import { Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { RunControls } from "@/components/ui/RunControls";
import type { GeoManifest } from "@/components/scene/OrbitScene";

export function BelegeView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const traces = useJSON<TracesFile>("traces.json");
  const assumptions = useJSON<AssumptionsFile>("assumptions.json");
  const geo = useAssetJSON<GeoManifest>("geo/manifest.json");
  return (
    <Ready items={[manifest, traces, assumptions, geo] as const}>
      {(m, t, a, g) => <Belege manifest={m} traces={t} assumptions={a} geo={g} />}
    </Ready>
  );
}

function Belege({
  manifest,
  traces,
  assumptions,
  geo,
}: {
  manifest: Manifest;
  traces: TracesFile;
  assumptions: AssumptionsFile;
  geo: GeoManifest;
}) {
  const { selection } = useSelection(manifest);
  const sp = useSearchParams();
  // Anker wie #pruefstand oder #karten existieren erst nach dem Laden; Next findet sie beim Seitenwechsel nicht und scrollt nicht.
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h) document.getElementById(h)?.scrollIntoView();
  }, []);
  const router = useRouter();
  const pathname = usePathname();
  // Gewählter Scope zuerst; fehlen dort Belege, Rückfall auf „alle Nutzlasten“ desselben Szenarios und Jahres.
  const ownId = runId(selection);
  const fallback = !traces.traces[ownId];
  const id = fallback ? runId({ ...selection, scope: "all_payloads" }) : ownId;
  const runTraces = traces.traces[id] ?? {};
  const ids = Object.keys(runTraces);
  const kpi = sp?.get("kpi") && runTraces[sp.get("kpi")!] ? sp.get("kpi")! : ids.includes("e2_share_mass") ? "e2_share_mass" : ids[0];
  const t: Trace | undefined = runTraces[kpi];
  const rows = new Map(assumptions.rows.map((r) => [r.key, r]));

  const choose = (k: string) => {
    const q = new URLSearchParams(sp?.toString());
    q.set("kpi", k);
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHead title="Evidence" />
      <div className="border-y border-rule/70 bg-night/92 lg:sticky lg:top-[var(--header-h)] lg:z-30 lg:backdrop-blur-md">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-end gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
          <RunControls manifest={manifest} />
          <label className="flex min-w-0 flex-col text-[0.82rem] text-mist">
            Metric
            <select value={kpi} onChange={(e) => choose(e.target.value)} className="mt-1.5 h-[2.6rem] max-w-full border border-rule-strong bg-night-2 px-3 text-[0.95rem] text-snow">
              {ids.map((k) => (
                <option key={k} value={k}>
                  {runTraces[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 pt-6 sm:px-8">
        <ProvenanceNote p={traces.provenance} />
        {fallback && selection.scope !== "all_payloads" && (
          <p className="mt-2 text-[0.88rem] text-amber">No evidence available for this scope; showing “all payloads” for the same scenario and year.</p>
        )}
      </div>

      {t ? (
        <>
          <Section id="kennzahl" title={t.label}>
            <p className="num font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold text-snow">{fmtValue(t.value, t.unit)}</p>
            <p className="metric mt-1 text-mist">
              {t.kpi_id} · Run {id}
            </p>
            {t.note && <p className="mt-3 max-w-[68ch] text-mist">{t.note}</p>}
          </Section>
          <Section id="formel" title="Formula and inputs">
            <pre className="overflow-x-auto whitespace-pre-wrap border border-rule bg-night-2 px-4 py-3 font-mono text-[0.85rem] text-snow">{t.formula}</pre>
            <table className="mt-5 w-full border-collapse text-left text-[0.92rem] num">
              <tbody>
                {Object.entries(t.inputs).map(([k, v]) => (
                  <tr key={k} className="border-b border-rule/50">
                    <td className="py-1.5 pr-4 text-mist">{k}</td>
                    <td className="py-1.5 text-right text-snow">{typeof v === "number" ? fmtNum(v, Math.abs(v) < 10 && !Number.isInteger(v) ? 4 : Number.isInteger(v) ? 0 : 2) : v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section id="annahmen" title="Assumptions">
            {t.assumption_keys.length === 0 ? (
              <p className="text-mist">No YAML assumption feeds into this metric.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="stack-sm w-full border-collapse text-left text-[0.9rem] md:min-w-[720px]">
                  <thead className="text-mist">
                    <tr className="border-b border-rule">
                      <th className="py-2 pr-4 font-normal">Assumption</th>
                      <th className="py-2 pr-4 font-normal">Value</th>
                      <th className="py-2 pr-4 font-normal">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.assumption_keys.map((k) => {
                      const r = rows.get(k);
                      const team = r?.source?.includes("Team-Annahme");
                      const u = r?.source ? urlOf(r.source) : undefined;
                      return (
                        <tr key={k} className="border-b border-rule/50 align-top">
                          <td className="metric py-2 pr-4 text-snow" data-label="Assumption">{k}</td>
                          <td className="max-w-[22rem] break-words py-2 pr-4" data-label="Value">
                            {r ? fmtRaw(r.value, r.unit) : "–"} {r?.unit}
                          </td>
                          <td className="py-2 pr-4 text-mist" data-label="Source">
                            {team && (
                              <span className="mr-2 inline-flex items-center gap-1.5 text-[0.8rem] text-alert">
                                <span aria-hidden="true" className="size-1.5 rounded-full bg-alert" />
                                Team assumption
                              </span>
                            )}
                            {team && r?.source?.trim() === "Team-Annahme" ? null : u ? (
                              <a href={u} className="break-all">
                                {r!.source.replace(/^https?:\/\//, "")}
                              </a>
                            ) : (
                              r?.source ?? "–"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
          <Section id="vergleich" title="Benchmarks">
            {t.references.length === 0 ? (
              <p className="text-mist">No external benchmark in config/references.yaml for this metric.</p>
            ) : (
              <ul className="divide-y divide-rule/60 border-y border-rule">
                {t.references.map((r) => (
                  <li key={r.key} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]">
                    <span className="text-snow">
                      {r.key}: {fmtRaw(r.value, r.unit)} {r.unit} {r.year ? `(${r.year})` : ""}
                    </span>
                    <span className="text-[0.88rem] text-mist">{urlOf(r.source) ? <a href={urlOf(r.source)}>{new URL(urlOf(r.source)!).hostname}</a> : r.source}</span>
                    {r.note && <span className="text-[0.86rem] text-mist sm:col-span-2">{r.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : (
        <Section id="kennzahl" title="No evidence">
          <p className="text-mist">No evidence available for this run.</p>
        </Section>
      )}

      <Section id="datenstand" title="Data status">
        <ProvenanceTable p={traces.provenance} />
      </Section>

      <Section id="karten" title="Maps, images and fonts">
        <ul className="divide-y divide-rule/60 border-y border-rule text-[0.92rem]">
          {Object.entries(geo.files).map(([name, f]) => (
            <li key={name} className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
              <span className="metric text-snow">{name}</span>
              <span className="text-mist">
                {f.title ?? f.source}. {f.credit}. Licence: {f.license}.{f.acquired ? ` Acquired ${f.acquired.join(", ")}.` : ""}
              </span>
            </li>
          ))}
          <li className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
            <span className="metric text-snow">Pad coordinate</span>
            <span className="text-mist">
              {geo.pad.label}: {geo.pad.lat}, {geo.pad.lon} (WGS84), ±{geo.pad.accuracy_m} m, {geo.pad.basis}.
            </span>
          </li>
          <li className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
            <span className="metric text-snow">Fonts</span>
            <span className="text-mist">Red Hat Display, Geist and Geist Mono, SIL Open Font License 1.1, served locally.</span>
          </li>
        </ul>
      </Section>
    </>
  );
}

function ProvenanceTable({ p }: { p: Provenance }) {
  const rows: [string, string][] = [
    ["Status", p.status === "fixture" ? p.label : "Engine delivery"],
    ["Generated", `${p.generated_at} · ${p.generated_by}`],
    ["Contract", p.contract],
    ["Engine commit", `${p.source_commit} (${p.source_commit_subject ?? ""})`],
    ["Data source", `${p.data_source ?? "–"}${p.fallback_reason ? ` (Fallback: ${p.fallback_reason})` : ""}`],
    ["Snapshot ID", p.snapshot_id ?? "–"],
    ["GCAT catalogue date", fmtDate(p.catalog_date)],
    ["Data end 2026 (annualisation)", fmtDate(p.annualization_date)],
    ["satcat SHA256", p.satcat_sha256 ?? "–"],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 text-[0.92rem] sm:grid-cols-[16rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-mist">{k}</dt>
          <dd className={`text-snow ${/^[0-9a-f]{16,}$/i.test(v.split(" ")[0]) ? "break-all" : "break-words"}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
