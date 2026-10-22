"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AssumptionsFile, Manifest, Provenance, StatsFile, Trace, TracesFile } from "@/lib/contract";
import { type Loadable, useAssetJSON, useJSON } from "@/lib/data";
import { fmtDate, fmtNum, fmtRaw, fmtValue, urlOf } from "@/lib/format";
import { SCOPE_LABELS } from "@/lib/labels";
import { runId, useSelection } from "@/lib/selection";
import { PageHead, Section } from "@/components/shell/PageHead";
import { ErrorState, Loading, Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { RunControls } from "@/components/ui/RunControls";
import type { GeoManifest } from "@/components/scene/OrbitScene";

export function BelegeView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const traces = useJSON<TracesFile>("traces.json");
  const assumptions = useJSON<AssumptionsFile>("assumptions.json");
  const geo = useAssetJSON<GeoManifest>("geo/manifest.json");
  // Prüfstand ist optional: Laden oder Fehlen von stats.json betrifft nur seinen Abschnitt, nicht die Seite.
  const stats = useJSON<StatsFile>("stats.json");
  return (
    <Ready items={[manifest, traces, assumptions, geo] as const}>
      {(m, t, a, g) => <Belege manifest={m} traces={t} assumptions={a} geo={g} stats={stats} />}
    </Ready>
  );
}

function Belege({
  manifest,
  traces,
  assumptions,
  geo,
  stats,
}: {
  manifest: Manifest;
  traces: TracesFile;
  assumptions: AssumptionsFile;
  geo: GeoManifest;
  stats: Loadable<StatsFile>;
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
      <PageHead title="Belege">Woher jede Zahl kommt: Formel, Eingangszahlen, Annahmen mit Quelle, Vergleichswerte und Datenstand. Wörtlich aus dem Rechenkern.</PageHead>
      <div className="border-y border-rule/70 bg-night/92 lg:sticky lg:top-[var(--header-h)] lg:z-30 lg:backdrop-blur-md">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-end gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
          <RunControls manifest={manifest} />
          <label className="flex min-w-0 flex-col text-[0.82rem] text-mist">
            Kennzahl
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
          <p className="mt-2 text-[0.88rem] text-amber">Für diesen Scope liegen keine Belege vor; angezeigt wird „alle Nutzlasten“ desselben Szenarios und Jahres.</p>
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
          <Section id="formel" title="Formel und Eingangszahlen">
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
          <Section id="annahmen" title="Annahmen">
            {t.assumption_keys.length === 0 ? (
              <p className="text-mist">Keine YAML-Annahme geht in diese Kennzahl ein.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="stack-sm w-full border-collapse text-left text-[0.9rem] md:min-w-[720px]">
                  <thead className="text-mist">
                    <tr className="border-b border-rule">
                      <th className="py-2 pr-4 font-normal">Annahme</th>
                      <th className="py-2 pr-4 font-normal">Wert</th>
                      <th className="py-2 pr-4 font-normal">Quelle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.assumption_keys.map((k) => {
                      const r = rows.get(k);
                      const team = r?.source?.includes("Team-Annahme");
                      const u = r?.source ? urlOf(r.source) : undefined;
                      return (
                        <tr key={k} className="border-b border-rule/50 align-top">
                          <td className="metric py-2 pr-4 text-snow" data-label="Annahme">{k}</td>
                          <td className="max-w-[22rem] break-words py-2 pr-4" data-label="Wert">
                            {r ? fmtRaw(r.value, r.unit) : "–"} {r?.unit}
                          </td>
                          <td className="py-2 pr-4 text-mist" data-label="Quelle">
                            {team && (
                              <span className="mr-2 inline-flex items-center gap-1.5 text-[0.8rem] text-alert">
                                <span aria-hidden="true" className="size-1.5 rounded-full bg-alert" />
                                Team-Annahme
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
          <Section id="vergleich" title="Vergleichswerte">
            {t.references.length === 0 ? (
              <p className="text-mist">Kein externer Vergleichswert in config/references.yaml für diese Kennzahl.</p>
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
        <Section id="kennzahl" title="Kein Beleg">
          <p className="text-mist">Für diesen Run liegen keine Belege vor.</p>
        </Section>
      )}

      <Section
        id="pruefstand"
        title="Gerechnet wird im getesteten Rechenkern, die Seite zeigt nur"
        intro="Gezählt aus einem echten Testlauf und aus den gelieferten Belegen (scripts/write-stats.mjs), nicht von Hand eingetragen."
      >
        {stats.state === "ready" ? (
          <Pruefstand s={stats.data} p={traces.provenance} />
        ) : stats.state === "loading" ? (
          <Loading label="Prüfstand wird geladen" />
        ) : (
          <ErrorState error={stats.error.endsWith("HTTP 404") ? "stats.json fehlt im Export, erzeugen mit node scripts/write-stats.mjs" : stats.error} retry={stats.retry} />
        )}
      </Section>

      <Section id="datenstand" title="Datenstand">
        <ProvenanceTable p={traces.provenance} />
      </Section>

      <Section id="karten" title="Karten, Bilder und Schriften">
        <ul className="divide-y divide-rule/60 border-y border-rule text-[0.92rem]">
          {Object.entries(geo.files).map(([name, f]) => (
            <li key={name} className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
              <span className="metric text-snow">{name}</span>
              <span className="text-mist">
                {f.title ?? f.source}. {f.credit}. Lizenz: {f.license}.{f.acquired ? ` Aufnahme ${f.acquired.join(", ")}.` : ""}
              </span>
            </li>
          ))}
          <li className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
            <span className="metric text-snow">Pad-Koordinate</span>
            <span className="text-mist">
              {geo.pad.label}: {geo.pad.lat}, {geo.pad.lon} (WGS84), ±{geo.pad.accuracy_m} m, {geo.pad.basis}.
            </span>
          </li>
          <li className="grid gap-1 py-3 md:grid-cols-[14rem_1fr]">
            <span className="metric text-snow">Schriften</span>
            <span className="text-mist">Red Hat Display, Geist und Geist Mono, SIL Open Font License 1.1, lokal ausgeliefert.</span>
          </li>
        </ul>
      </Section>
    </>
  );
}

/** Prüfstand: eine große Zahl (bestandene Tests), darunter gezählte Belege und der Datenfluss. Alle Werte aus stats.json bzw. Provenance. */
function Pruefstand({ s, p }: { s: StatsFile; p: Provenance }) {
  const { tests: t, web_tests: w, evidence: e } = s;
  const commit = t.fixture_commit.slice(0, 7);
  const ran = t.ran_at ? `${fmtDate(t.ran_at)}, ${t.ran_at.slice(11, 16)} Uhr` : "–";
  const source = p.data_source ? p.data_source[0].toUpperCase() + p.data_source.slice(1) : "–";
  const facts: [string, string][] = [
    ["Berichtsstand", "Archivierter Prüflauf des Fixture-Snapshots; kein Testnachweis für den aktuellen Live-Lauf"],
    ["Kennzahlen mit Formel und Eingangszahlen", `${fmtNum(e.kpis_complete)} von ${fmtNum(e.kpis)}`],
    ["Runs mit Belegen", `${fmtNum(e.runs_with_traces)} von ${fmtNum(e.runs_total)} (${e.traced_scopes.map((x) => SCOPE_LABELS[x] ?? x).join(", ")})`],
    ["Annahmen mit Quellenangabe", `${fmtNum(e.assumptions_with_source)} von ${fmtNum(e.assumptions_used)}, davon ${fmtNum(e.team_assumptions)} als Team-Annahme gekennzeichnet`],
    ["Tests der Weboberfläche", `${fmtNum(w.passed)} von ${fmtNum(w.total)} bestanden${w.failed > 0 ? `, ${fmtNum(w.failed)} fehlgeschlagen` : ""}`],
    ["Nicht im Prüfstand", "Kostenkurve unter „Kosten“: Kopie der Isar Case DB, nicht vom Python-Rechenkern berechnet"],
  ];
  const flow: [string, string][] = [
    ["GCAT-Katalog", `Stand ${fmtDate(p.catalog_date)} · Quelle ${source}`],
    ["Python-Rechenkern", `engine/ und config/*.yaml · ${fmtNum(t.passed)} Tests`],
    ["Ergebnisdateien", `JSON aus Engine-Commit ${p.source_commit.slice(0, 7)}`],
    ["Diese Seite", "zeigt die Ergebnisse, rechnet nicht"],
  ];

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <p className="num font-display text-[clamp(2rem,4vw,2.8rem)] font-semibold text-snow">{fmtNum(t.passed)}</p>
          <p className="text-snow">von {fmtNum(t.total)} Tests des Rechenkerns bestanden</p>
          {t.failed > 0 && (
            <div className="mt-1 text-alert">
              <p>{fmtNum(t.failed)} fehlgeschlagen:</p>
              <ul className="mt-1 space-y-1 text-[0.88rem]">
                {t.failures.map((f) => (
                  <li key={f.test}>
                    <span className="metric break-all">{f.test}</span>
                    <span className="block text-mist">{f.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.skipped > 0 && (
            <p className="mt-1 text-[0.92rem] text-mist">
              {fmtNum(t.skipped)} übersprungen{t.skip_reasons.length ? `: ${t.skip_reasons.map((r) => `${fmtNum(r.count)} × ${r.reason}`).join(", ")}` : ""}
            </p>
          )}
          <p className={`mt-4 max-w-[52ch] text-[0.95rem] ${t.engine_matches_fixture ? "text-mist" : "text-amber"}`}>
            {t.engine_matches_fixture ? (
              <>
                Geprüft wurde genau der Engine-Stand <span className="metric text-snow">{commit}</span>, aus dem die Zahlen dieser Seite stammen.
              </>
            ) : (
              <>
                Der geprüfte Engine-Stand weicht vom Stand der angezeigten Zahlen (<span className="metric">{commit}</span>) ab.
              </>
            )}
          </p>
          <p className="metric mt-2 text-[0.8rem] text-mist">
            {t.command} · {ran} · {fmtNum(t.seconds, 0)} s
          </p>
        </div>
        <dl className="divide-y divide-rule/60 border-y border-rule text-[0.92rem]">
          {facts.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[16rem_1fr]">
              <dt className="text-mist">{k}</dt>
              <dd className="text-snow">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ol aria-label="Datenfluss" className="mt-10 grid gap-px border border-rule bg-rule md:grid-cols-4">
        {flow.map(([h, d], i) => (
          <li key={h} className="relative bg-night px-5 py-4">
            <p className="font-medium text-snow">{h}</p>
            <p className="mt-1 text-[0.88rem] text-mist">{d}</p>
            {i < flow.length - 1 && (
              <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 bg-night px-0.5 text-ice md:block">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function ProvenanceTable({ p }: { p: Provenance }) {
  const rows: [string, string][] = [
    ["Status", p.status === "fixture" ? p.label : "Fachlieferung"],
    ["Erzeugt", `${p.generated_at} · ${p.generated_by}`],
    ["Vertrag", p.contract],
    ["Engine-Commit", `${p.source_commit} (${p.source_commit_subject ?? ""})`],
    ["Datenquelle", `${p.data_source ?? "–"}${p.fallback_reason ? ` (Fallback: ${p.fallback_reason})` : ""}`],
    ["Snapshot-ID", p.snapshot_id ?? "–"],
    ["GCAT-Katalogstand", fmtDate(p.catalog_date)],
    ["Datenende 2026 (Annualisierung)", fmtDate(p.annualization_date)],
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
