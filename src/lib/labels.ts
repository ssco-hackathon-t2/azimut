// Beschriftungen wörtlich aus app/common.py (STAGE_LABELS, REASON_LABELS, scope_label, CLASS_LABELS).
import type { DataStatus, ScenarioId, ScopeId, StageName } from "./contract";

export const STAGE_LABELS: Record<StageName, string> = {
  E0: "E0 global gestartet",
  E1: "E1 technisch erreichbar",
  E2: "E2 adressierbar",
  E3: "E3 gewinnbar",
};

export const REASON_LABELS: Record<string, string> = {
  INC_OUT: "Inklination außerhalb Fenster",
  ALT_OUT: "Höhe/Orbit außerhalb (GEO/GTO/MEO, zu hoch)",
  MASS_OUT: "Masse über Nutzlast",
  ORBIT_UNKNOWN: "Orbit unbekannt",
  CAPTIVE: "Captive-Konstellation",
  GEO_BLOCK: "Staat nicht in Whitelist",
  US_NATSEC: "US National Security",
  WINRATE: "Win-Rate (Erwartungswert)",
  CAPACITY: "Kapazität (Cadence-Cap)",
};

export const SCOPE_LABELS: Record<ScopeId, string> = {
  all_payloads: "alle Nutzlasten",
  smallsats_le_1200kg: "Smallsats ≤ 1.200 kg",
  non_captive: "ohne captive Konstellationen",
  open_market: "offener Markt (ohne CN/RU/IR/KP, ohne US-NatSec)",
};

export const SCOPE_SHORT: Record<ScopeId, string> = {
  all_payloads: "Alle Nutzlasten",
  smallsats_le_1200kg: "Smallsats ≤ 1,2 t",
  non_captive: "Ohne captive",
  open_market: "Offener Markt",
};

/** data_status der Isar Case DB als Text: Status nie nur über Farbe. */
export const STATUS_LABELS: Record<DataStatus, string> = {
  belegt: "belegt",
  abgeleitet: "abgeleitet",
  annahme: "Annahme",
  team_annahme: "Team-Annahme",
  unbestaetigt: "unbestätigt",
  widerspruechlich: "widersprüchlich",
};

export const SCENARIO_FALLBACK: Record<ScenarioId, string> = {
  conservative: "konservativ",
  base: "Basis",
  optimistic: "optimistisch",
};

export const CLASS_LABELS: Record<string, string> = {
  A: "Amateur/Edu",
  B: "kommerziell",
  C: "zivil-staatlich",
  D: "militärisch",
};
