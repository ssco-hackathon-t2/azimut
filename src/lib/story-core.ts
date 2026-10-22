// Reine Story-Logik ohne React (testbar mit node --test). Kapitel und Texte stehen in public/data/story.json,
// Zahlen nur als Verweis auf die Daten-JSONs (knowledge/05_storyline.md: keine Zahl im Markup).
// Startseite ist Englisch (22.10.2026): eigenes englisches Zahlenformat; lib/format.ts bleibt deutsch für die übrigen Seiten.

const en = (d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtNumEn = (x: number | null | undefined, d = 0) => (ok(x) ? en(d).format(x) : "–");
/** Anteil (0..1) als Prozent, englisch ohne Leerzeichen: 8.9%. */
export const fmtPctEn = (x: number | null | undefined, d = 1) => (ok(x) ? `${en(d).format(x * 100)}%` : "–");
/** ISO-Datum als 30 Mar 2025; anderes bleibt unverändert. */
export function fmtDateEn(iso: string | null | undefined): string {
  if (!iso) return "–";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

export type Row = Record<string, unknown>;
/** Alle Tabellen nach Namen: isar_data.json plus `sites` aus sites_compare.json. */
export type Tables = Record<string, Row[]>;
export type Fmt = "pct" | "num" | "int" | "date" | "text";

export interface Kpi {
  /** Verweis: "kpi_id" (derived_kpis) oder "tabelle:zeilen_id:spalte". */
  ref: string;
  /** Optionaler Nenner: zeigt ref / of als Anteil. */
  of?: string;
  label: string;
  note?: string;
  prefix?: string;
  suffix?: string;
  digits?: number;
  format?: Fmt;
  tone?: "win" | "accent";
}

/** title: Überschrift der aufklappbaren Zeile im Kapitel (Grafiken und Texte starten zugeklappt). */
export type Block = { title?: string } & (
  | { kind: "text"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "placeholder"; text: string }
  | { kind: "panel"; id: string; initialView?: string }
  /** Interaktiver Block aus dem Design-Canvas Skizze Flow (components/flow). */
  | { kind: "flow"; id: "orbits" | "startplaetze" | "fabrik" | "empfehlung" }
  | { kind: "funnel" | "keystatement" | "scenarios" | "inclination" | "q1" | "links" }
);

export interface Chapter {
  id: string;
  nav: string;
  kicker?: string;
  title: string;
  lead?: string;
  kpis?: Kpi[];
  blocks?: Block[];
  /** Kapitel startet zugeklappt (nur Kicker mit „+“); öffnet per Klick oder Link auf #id. */
  collapsed?: boolean;
}

export interface Story {
  hero: { nav: string; kicker?: string; title: string; lead?: string; claim?: string };
  chapters: Chapter[];
}

export interface Value {
  value: number | string | null;
  label: string;
  status: string;
  unit: string;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Verweis auflösen; null, wenn Kennzahl, Zeile oder Spalte fehlt (nie still durch 0 ersetzen). */
export function lookup(t: Tables, ref: string): Value | null {
  const [a, b, c] = ref.split(":").map((s) => s.trim());
  if (b === undefined) {
    const k = t.derived_kpis?.find((r) => r.id === a);
    if (!k) return null;
    return { value: toNum(k.value_base), label: String(k.label ?? a), status: String(k.data_status ?? ""), unit: String(k.unit ?? "") };
  }
  const r = t[a]?.find((x) => x.id === b);
  if (!r || c === undefined || !(c in r)) return null;
  const raw = r[c];
  const n = toNum(raw);
  // Spaltennamen wie e1_share_count tragen Anteile (0..1).
  const unit = /(^|_)share(_|$)/.test(c) ? "share" : "";
  return { value: n ?? (raw == null ? null : String(raw)), label: `${a} ${b}, ${c}`, status: String(r.data_status ?? ""), unit };
}

/** Verweis mit optionalem Nenner; ein Verhältnis ist immer abgeleitet. */
export function resolve(t: Tables, ref: string, of?: string): Value | null {
  const v = lookup(t, ref);
  if (!v || !of) return v;
  const d = lookup(t, of);
  if (!d || typeof v.value !== "number" || typeof d.value !== "number" || d.value === 0) return null;
  return { value: v.value / d.value, label: `${v.label} / ${d.label}`, status: "abgeleitet", unit: "share" };
}

export function defaultFmt(v: Value): Fmt {
  if (typeof v.value === "string") return /^\d{4}-\d{2}-\d{2}/.test(v.value) ? "date" : "text";
  return v.unit === "share" ? "pct" : "num";
}

/** Stellen aus dem Zielwert, damit hochzählende Zahlen nicht springen. */
function autoDigits(fmt: Fmt, target: number): number {
  if (fmt === "pct") return Math.abs(target) < 0.01 ? 2 : Number.isInteger(+(target * 100).toFixed(6)) ? 0 : 1;
  if (fmt === "int") return 0;
  return Number.isInteger(target) ? 0 : 1;
}

export function fmtValue(v: number | string | null, fmt: Fmt, digits?: number, target?: number): string {
  if (v == null) return "–";
  if (typeof v === "string") return fmt === "date" ? fmtDateEn(v) : v;
  const d = digits ?? autoDigits(fmt, target ?? v);
  return fmt === "pct" ? fmtPctEn(v, d) : fmtNumEn(v, d);
}

/** Datenstatus (Schlüssel bleiben deutsch wie in den Daten-JSONs), Anzeige englisch. */
export const STATUS_LABELS: Record<string, string> = {
  belegt: "verified",
  abgeleitet: "derived",
  annahme: "assumption",
  team_annahme: "team assumption",
  unbestaetigt: "unconfirmed",
  widerspruechlich: "contradictory",
};

export const statusLabel = (s: string) => STATUS_LABELS[s] ?? (s || "no status");

export type Piece = string | { text: string; title: string; missing: boolean };

/** Text mit {{verweis}} oder {{verweis|pct|0}} in Stücke zerlegen; fehlende Verweise bleiben sichtbar. */
export function splitTokens(text: string, t: Tables): Piece[] {
  return text
    .split(/(\{\{[^}]+\}\})/)
    .filter(Boolean)
    .map((p) => {
      const m = /^\{\{\s*([^}|]+?)\s*(?:\|\s*(pct|num|int|date|text)\s*)?(?:\|\s*(\d)\s*)?\}\}$/.exec(p);
      if (!m) return p;
      const v = lookup(t, m[1]);
      if (!v) return { text: `[${m[1]} missing]`, title: `Reference ${m[1]} not found in the data`, missing: true };
      return { text: fmtValue(v.value, (m[2] as Fmt) ?? defaultFmt(v), m[3] ? Number(m[3]) : undefined), title: `${v.label} · ${statusLabel(v.status)}`, missing: false };
    });
}

/** Alle Verweise eines Story-Texts, z. B. für die Prüfung „keine Zahl fehlt“. */
export function refsIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}|]+?)\s*(?:\|[^}]*)?\}\}/g)].map((m) => m[1]);
}

// sites-compare/1 aus scripts/site_coverage.py (Sternstewart/scripts), Vertrag in knowledge/07_orchestrierung.md.
export interface Site {
  id: string;
  label: string;
  inc_min: number;
  inc_max: number;
  e1_share_count: number;
  e2_count: number;
  e2_share_count: number;
  e2_extra_vs_andoya: number;
  missions_per_year: number;
  isar_status?: string;
  data_status?: string;
  /** Stammdaten aus launch_sites (Text in der Case-DB). */
  lat?: string | number;
  lon?: string | number;
  country?: string;
}

export interface SitesCompare {
  provenance: { contract: string; generated_at: string; engine_commit: string; basis_year: number; data_status: string };
  e0_count: number;
  union_e2_count: number;
  /** Optional: exakte Union je Teilmenge, Schlüssel = IDs in Reihenfolge von sites, mit "+" verbunden. */
  unions?: Record<string, number>;
  /** Wie unions, aber technisch erreichbar (E1, Anzahl). */
  unions_e1?: Record<string, number>;
  sites: Site[];
  histogram_inc_2deg: { inc_from: number; offen: number; captive: number; gesperrt: number; nicht_tauglich: number }[];
  q1?: {
    window_alt: { inc_min: number; inc_max: number; e1_share_count: number; e2_count: number; missions_per_year: number };
    global_launches_2025: number;
    sso_launches_2025: number;
    note?: string;
  };
  /** Engpass-Kette je Standort-Portfolio (Frage 3), Stufen von der Fabrik bis zur gewinnbaren Nachfrage. */
  portfolios?: { items: { id: string; label: string; chain: { id: string; label: string; value: number | null; status: string }[] }[] };
}

/** Verweisbare Tabellen: Case-DB plus Standortvergleich (sites:<id>:<feld>, sites_meta:all:<feld>). */
export function buildTables(db: Tables, sc?: SitesCompare): Tables {
  if (!sc) return db;
  const status = sc.provenance?.data_status ?? "abgeleitet";
  return {
    ...db,
    // Die Kennzahlen je Standort sind gerechnet: Status aus der Provenienz, nicht der Stammdatenstatus des Standorts.
    sites: sc.sites.map((s) => ({ ...s, data_status: status })) as unknown as Row[],
    sites_meta: [{ id: "all", e0_count: sc.e0_count, union_e2_count: sc.union_e2_count, data_status: status }],
    // portfolio_chain:<portfolio>_<stufe>:value, z. B. A_nachfrage (nur Andøya) oder D_fabrik.
    portfolio_chain: (sc.portfolios?.items ?? []).flatMap((p) =>
      p.chain.map((c) => ({ id: `${p.id}_${c.id}`, value: c.value, data_status: c.status, label: `${p.label}: ${c.label}` })),
    ),
  };
}

/** Union-Schlüssel einer Auswahl in der Reihenfolge der Standortliste. */
export function unionKey(sites: Site[], on: Set<string>): string {
  return sites.filter((s) => on.has(s.id)).map((s) => s.id).join("+");
}

/** Exakte Union aus den Daten; ein einzelner Standort ist seine eigene E2-Zahl, sonst nur mit gelieferten unions. */
export function unionCount(sc: SitesCompare, on: Set<string>): number | null {
  const chosen = sc.sites.filter((s) => on.has(s.id));
  if (chosen.length === 0) return null;
  if (chosen.length === 1) return chosen[0].e2_count;
  if (chosen.length === sc.sites.length) return sc.union_e2_count;
  return sc.unions?.[unionKey(sc.sites, on)] ?? null;
}
