// Vorgeschlagener Browser-Vertrag "andoya-ui-results/0.1-proposal" (docs/frontend/INTEGRATION_REQUESTS.md).
// Die Typen beschreiben nur, was die Oberfläche liest. Gerechnet wird ausschließlich im Fachlauf.

export type ScenarioId = "conservative" | "base" | "optimistic";
export type ScopeId = "all_payloads" | "smallsats_le_1200kg" | "non_captive" | "open_market";
export type StageName = "E0" | "E1" | "E2" | "E3";

export interface Provenance {
  status: "fixture" | "delivered";
  label: string;
  contract: string;
  generated_at: string;
  generated_by: string;
  source_commit: string;
  source_commit_subject?: string;
  data_source: string | null;
  snapshot_id: string | null;
  fallback_reason?: string | null;
  rows?: number | null;
  catalog_date: string | null;
  downloaded_at?: string | null;
  annualization_date?: string | null;
  satcat_sha256?: string | null;
}

export interface Manifest {
  provenance: Provenance;
  scenarios: ScenarioId[];
  years: number[];
  scopes: ScopeId[];
  files: string[];
}

export interface Stage {
  name: StageName;
  count: number;
  mass_kg: number;
  share_count: number;
  share_mass: number;
}

export interface Reason {
  reason: string;
  stage: StageName;
  count: number;
  mass_kg: number;
}

export interface E3Result {
  missions_demanded: number;
  missions_served: number;
  mass_served_kg: number;
  revenue_eur: number;
  sats_expected: number;
  year: number;
  scenario: ScenarioId;
  dedicated_missions_served?: number;
  rideshare_missions_served?: number;
  rideshare_kg_served?: number;
  served_share?: number;
  demand_weight_sum?: number;
  winrate_weighted_mean?: number;
  competition_factor?: number;
  growth_years?: number;
}

export interface RunParams {
  site_id: string;
  vehicle_id: string;
  year: number;
  scenario: ScenarioId;
  scope: ScopeId;
  year_basis: "base" | "ytd";
  snapshot_date?: string | null;
}

export interface Run {
  run_id: string;
  params: RunParams;
  basis: { year_basis: string; basis_year: number; annualization_factor: number; label: string };
  forecast: null | {
    year: number;
    scenario: ScenarioId;
    growth_years: number;
    captive_growth: number;
    segment_growth: Record<string, number>;
    competition_factor: number;
  };
  stages: Stage[];
  reasons: Reason[];
  e3: E3Result;
  by_vertical: { vertical: string; stage: StageName; count: number; mass_kg: number }[] | null;
  missions_by_kind: { kind: string; flights: number; sats: number; mass_kg: number }[];
  e2_rows: number | null;
}

export interface RunsFile {
  provenance: Provenance;
  runs: Run[];
}

export interface TraceReference {
  key: string;
  value: number | string | null;
  unit: string;
  source: string;
  note?: string;
  year?: number | null;
}

export interface Trace {
  kpi_id: string;
  label: string;
  value: number;
  unit: string;
  formula: string;
  inputs: Record<string, number | string>;
  assumption_keys: string[];
  references: TraceReference[];
  snapshot: Record<string, string | number | null>;
  note?: string;
}

export interface TracesFile {
  provenance: Provenance;
  traces: Record<string, Record<string, Trace>>;
}

export interface TimelineRow {
  year: number;
  scenario: ScenarioId;
  e2_count: number;
  e2_mass_kg: number;
  e0_count_proj: number;
  e0_mass_kg_proj: number;
  share_count: number;
  share_mass: number;
  e3_missions_demanded: number;
  e3_missions_served: number;
  e3_revenue_eur: number;
  ramp_cap: number | null;
  e3_count?: number;
  e3_mass_kg?: number;
}

export interface TimelineFile {
  provenance: Provenance;
  by_scope: Record<ScopeId, { rows: TimelineRow[]; meta: Record<string, unknown> }>;
}

export interface HistoryPoint {
  year: number;
  count: number;
  mass_kg: number;
  mass_known_share: number | null;
}

export interface HistoryFile {
  provenance: Provenance;
  years: number[];
  partial_year: { year: number; label: string; snapshot_date?: string } | null;
  mass_known_reliable_from: number | null;
  series: Record<"all" | "no_captive", Record<string, Record<string, HistoryPoint[]>>>;
}

export interface DistributionsFile {
  provenance: Provenance;
  run_id: string;
  inc_deg: { edges: number[]; e0_count: number[]; e0_rows_with_inc: number; e0_rows: number };
  mass_kg: { edges: number[]; e0_count: number[]; e0_rows_with_mass: number };
}

/** YAML-Blatt {value, unit, source, note[, quote]} wie in config/*.yaml. */
export interface Leaf<T = unknown> {
  value: T;
  unit: string;
  source: string;
  note?: string;
  quote?: string;
}

export interface EventEntry {
  id: string;
  date: string;
  title: string;
  type: string;
  segments: string[];
  note?: string;
  source: string;
  confidence?: string;
}

export interface ConfigFile {
  provenance: Provenance;
  sites: Record<string, Record<string, Leaf>>;
  vehicles: Record<string, Record<string, Leaf>>;
  isar_ramp: Leaf<Record<string, Record<ScenarioId, number>>>;
  scenario_labels: Leaf<Record<ScenarioId, string>>;
  events: { meta?: Record<string, string>; events: EventEntry[] };
  analog_ramps: {
    meta?: Record<string, string>;
    ramps: Record<string, Record<string, unknown>>;
    isar?: Record<string, unknown>;
  };
  verticals: Record<string, unknown>;
  history_cfg: Record<string, unknown>;
  references: Record<string, unknown>;
}

export interface AssumptionRow {
  key: string;
  value: unknown;
  unit: string;
  source: string;
  note?: string;
}

export interface AssumptionsFile {
  provenance: Provenance;
  rows: AssumptionRow[];
}

// Isar Case DB (data/build/isar_data.json, Kopie unter public/data/isar/, INTEGRATION_REQUESTS IR-09).
// Alle Werte kommen als Text und tragen ihren data_status. Nur die gelesenen Spalten sind typisiert.
export type DataStatus = "belegt" | "abgeleitet" | "annahme" | "team_annahme" | "unbestaetigt" | "widerspruechlich";

export interface IsarDb {
  cost_curve: {
    id: string;
    launches_per_year: string;
    variable_cost_eur_m: string;
    fixed_cost_per_launch_eur_m: string;
    cost_per_launch_eur_m: string;
    data_status: DataStatus;
    source_chat: string;
  }[];
  derived_kpis: { id: string; label: string; value_low: string; value_base: string; value_high: string; unit: string; formula: string; data_status: DataStatus }[];
  scenarios: { id: string; name: string; year: string; launches_total: string; result_eur_m: string; data_status: DataStatus }[];
  assumptions: { id: string; value_low: string; value_base: string; value_high: string; unit: string; data_status: DataStatus; source_id: string }[];
  sources: { id: string; title: string; url: string; publisher: string }[];
}

/** Prüfstand aus scripts/write-stats.mjs: echter pytest-Lauf plus gezählte Belege, nichts getippt. */
export interface StatsFile {
  generated_at: string;
  generated_by: string;
  tests: {
    command: string;
    ran_at: string | null;
    seconds: number;
    total: number;
    passed: number;
    failed: number;
    failures: { test: string; message: string }[];
    skipped: number;
    skip_reasons: { reason: string; count: number }[];
    repo_commit: string;
    fixture_commit: string;
    engine_matches_fixture: boolean;
  };
  web_tests: { total: number; passed: number; failed: number; skipped: number };
  evidence: {
    runs_total: number;
    runs_with_traces: number;
    traced_scopes: ScopeId[];
    kpis: number;
    kpis_complete: number;
    assumptions_used: number;
    assumptions_with_source: number;
    team_assumptions: number;
  };
}
