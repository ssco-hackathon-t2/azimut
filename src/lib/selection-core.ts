// Reine Auswahl-Logik ohne Next.js-Abhängigkeit (testbar mit node --test).
import type { Manifest, Run, ScenarioId, ScopeId } from "./contract";

// Ein aktiver Run für alle Ansichten, gehalten in der URL (?szenario=&jahr=&scope=).
// So funktionieren Direktaufruf, Reload und Vor/Zurück ohne Server.

export interface Selection {
  scenario: ScenarioId;
  year: number;
  scope: ScopeId;
}

export const DEFAULT_SELECTION: Selection = { scenario: "base", year: 2025, scope: "all_payloads" };

const SCENARIOS: ScenarioId[] = ["conservative", "base", "optimistic"];
const SCOPES: ScopeId[] = ["all_payloads", "smallsats_le_1200kg", "non_captive", "open_market"];

export function parseSelection(sp: URLSearchParams | null, manifest?: Manifest): Selection {
  const sc = sp?.get("szenario") as ScenarioId | null;
  const scope = sp?.get("scope") as ScopeId | null;
  const year = Number(sp?.get("jahr"));
  const years = manifest?.years ?? [DEFAULT_SELECTION.year];
  return {
    scenario: sc && SCENARIOS.includes(sc) ? sc : DEFAULT_SELECTION.scenario,
    scope: scope && SCOPES.includes(scope) ? scope : DEFAULT_SELECTION.scope,
    year: years.includes(year) ? year : DEFAULT_SELECTION.year,
  };
}

export function runId(s: Selection, site = "andoya"): string {
  return `${site}_${s.scope}_${s.year}_${s.scenario}`;
}

/** Run über seine Parameter finden (nicht über das ID-Schema, das der Fachlauf ändern darf). */
export function findRun(runs: Run[], s: Selection, site = "andoya"): Run | undefined {
  return runs.find(
    (r) =>
      r.params.scenario === s.scenario &&
      r.params.year === s.year &&
      r.params.scope === s.scope &&
      (r.params.site_id ?? site) === site &&
      (r.params.year_basis ?? "base") === "base",
  );
}

/** Headline-Run: geliefertes manifest.headline_run_id, sonst Basisjahr, Szenario Basis, alle Nutzlasten. */
export function headlineRun(runs: Run[], manifest?: Manifest & { headline_run_id?: string }): Run | undefined {
  const byId = manifest?.headline_run_id ? runs.find((r) => r.run_id === manifest.headline_run_id) : undefined;
  return byId ?? findRun(runs, DEFAULT_SELECTION);
}

export function selectionQuery(s: Selection): string {
  const q = new URLSearchParams();
  if (s.scenario !== DEFAULT_SELECTION.scenario) q.set("szenario", s.scenario);
  if (s.year !== DEFAULT_SELECTION.year) q.set("jahr", String(s.year));
  if (s.scope !== DEFAULT_SELECTION.scope) q.set("scope", s.scope);
  const str = q.toString();
  return str ? `?${str}` : "";
}

/** Auswahlparameter (szenario, jahr, scope) unverändert weiterreichen, andere (z. B. kpi) nicht. */
export function carryQuery(sp: URLSearchParams | null): string {
  const q = new URLSearchParams();
  for (const k of ["szenario", "jahr", "scope"]) {
    const v = sp?.get(k);
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Link auf die Beleg-Ansicht einer Kennzahl im Run dieser Auswahl. */
export function belegeHref(kpi: string, s: Selection): string {
  const q = selectionQuery(s);
  return `/belege/${q}${q ? "&" : "?"}kpi=${encodeURIComponent(kpi)}`;
}

export function selectionOf(run: Run): Selection {
  return { scenario: run.params.scenario, year: run.params.year, scope: run.params.scope };
}
