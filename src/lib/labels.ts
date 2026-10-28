// Beschriftungen wörtlich aus app/common.py (STAGE_LABELS, REASON_LABELS, scope_label, CLASS_LABELS).
import type { DataStatus, ScenarioId, ScopeId, StageName } from "./contract";

export const STAGE_LABELS: Record<StageName, string> = {
  E0: "E0 launched globally",
  E1: "E1 technically reachable",
  E2: "E2 addressable",
  E3: "E3 winnable",
};

export const REASON_LABELS: Record<string, string> = {
  INC_OUT: "Inclination outside window",
  ALT_OUT: "Altitude/orbit outside range (GEO/GTO/MEO, too high)",
  MASS_OUT: "Mass above payload capacity",
  ORBIT_UNKNOWN: "Orbit unknown",
  CAPTIVE: "Captive constellation",
  GEO_BLOCK: "Country not on whitelist",
  US_NATSEC: "US National Security",
  WINRATE: "Win rate (expected value)",
  CAPACITY: "Capacity (cadence cap)",
};

export const SCOPE_LABELS: Record<ScopeId, string> = {
  all_payloads: "all payloads",
  smallsats_le_1200kg: "smallsats ≤ 1,200 kg",
  non_captive: "excluding captive constellations",
  open_market: "open market (excl. CN/RU/IR/KP, excl. US NatSec)",
};

export const SCOPE_SHORT: Record<ScopeId, string> = {
  all_payloads: "All payloads",
  smallsats_le_1200kg: "Smallsats ≤ 1.2 t",
  non_captive: "Excl. captive",
  open_market: "Open market",
};

/** data_status der Isar Case DB als Text: Status nie nur über Farbe. */
export const STATUS_LABELS: Record<DataStatus, string> = {
  belegt: "verified",
  abgeleitet: "derived",
  annahme: "assumption",
  team_annahme: "team assumption",
  unbestaetigt: "unconfirmed",
  widerspruechlich: "contradictory",
};

export const SCENARIO_FALLBACK: Record<ScenarioId, string> = {
  conservative: "conservative",
  base: "base",
  optimistic: "optimistic",
};

export const CLASS_LABELS: Record<string, string> = {
  A: "Amateur/Edu",
  B: "commercial",
  C: "civil government",
  D: "military",
};
