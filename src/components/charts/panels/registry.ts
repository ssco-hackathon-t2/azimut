// Diagramm-Baukasten: Bausteine („kinds“), die aus Daten und Ansichtsoptionen ein ECharts-Option-Objekt
// und/oder eine Tabelle bauen. Welche Panels und Ansichten es gibt, steht in public/data/charts.json.
// Reine Funktionen ohne DOM und ohne Theme-Import: Farben kommen als Palette herein (testbar mit node --test).

export type Cell = string | number | null;
export interface Table {
  columns: [key: string, label: string, align?: "right"][];
  rows: Record<string, Cell>[];
}
export interface Control {
  key: string;
  label: string;
  values: [value: string, label: string][];
}
export interface ViewSpec {
  id: string;
  label: string;
  kind: string;
  /** Backup-Ansicht: nur im Eckmenü, nicht in der Hauptleiste. */
  backup?: boolean;
  note?: string;
  options?: Record<string, string>;
  controls?: Control[];
}
export interface PanelSpec {
  kicker?: string;
  title: string;
  lead?: string;
  /** Alias -> Pfad unter public/, z. B. { "sites": "data/sites/sites_compare.json" }. */
  sources: Record<string, string>;
  source_note?: string;
  status?: string;
  views: ViewSpec[];
}
export interface ChartsFile {
  version: number;
  panels: Record<string, PanelSpec>;
}
export interface Palette {
  accent: string;
  ink: string;
  mist: string;
  muted: string;
  rule: string;
  font: string;
  mono: string;
}
export interface Built {
  option?: Record<string, unknown>;
  table?: Table;
  height?: number;
}
export type Builder = (data: Record<string, any>, opts: Record<string, string>, p: Palette) => Built;

const nf = (d: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (x: number, d = 0) => nf(d).format(x);
const pct = (x: number, d = 1) => `${nf(d).format(x * 100)} %`;

// --------------------------------------------------------------------------- Frage 1: Trichter

const STAGE_LABEL: Record<string, string> = {
  E0: "Alle Nutzlasten 2025",
  E1: "Technisch erreichbar",
  E2: "Offen adressierbar",
  E3: "Gewinnbar",
};
const REASON_LABEL: Record<string, string> = {
  ORBIT_UNKNOWN: "Bahn unbekannt",
  INC_OUT: "Neigung außerhalb",
  ALT_OUT: "Höhe außerhalb",
  MASS_OUT: "Zu schwer für Spectrum",
  CAPTIVE: "Captive (eigene Rakete)",
  GEO_BLOCK: "China, Russland, Sonstige",
  US_NATSEC: "US-Sicherheit",
  WINRATE: "Wettbewerb (Win-Rate)",
  CAPACITY: "Kapazität",
};

/** Headline-Run: Basisjahr, Szenario Basis, alle Nutzlasten, Andøya. */
export function headlineRun(runs: { runs: any[] }) {
  return (
    runs.runs.find(
      (r) => r.params.site_id === "andoya" && r.params.scenario === "base" && r.params.scope === "all_payloads" && r.params.year_basis === "base" && r.forecast === null,
    ) ?? runs.runs[0]
  );
}

function funnelTable(run: any): Table {
  return {
    columns: [["stage", "Stufe"], ["count", "Nutzlasten", "right"], ["share_count", "Anteil", "right"], ["mass", "Masse", "right"], ["share_mass", "Anteil Masse", "right"]],
    rows: run.stages.map((s: any) => ({
      stage: `${s.name} ${STAGE_LABEL[s.name]}`,
      count: num(s.count, s.name === "E3" ? 1 : 0),
      share_count: pct(s.share_count, 1),
      mass: `${num(s.mass_kg / 1000, 1)} t`,
      share_mass: pct(s.share_mass, 2),
    })),
  };
}

const funnel: Builder = (data, opts, p) => {
  const run = headlineRun(data.runs);
  const mass = opts.metric === "mass";
  const log = opts.scale === "log";
  const stages = run.stages as any[];
  const value = (s: any) => (mass ? s.mass_kg / 1000 : s.count);
  return {
    height: 300,
    table: funnelTable(run),
    option: {
      grid: { left: 8, right: 128, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: log ? "log" : "value", show: false },
      yAxis: {
        type: "category",
        inverse: true,
        data: stages.map((s) => STAGE_LABEL[s.name]),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: p.mist, fontSize: 13 },
      },
      tooltip: { show: false },
      series: [
        {
          type: "bar",
          barWidth: "56%",
          data: stages.map((s) => ({ value: value(s), itemStyle: { color: s.name === "E2" ? p.accent : p.muted } })),
          label: {
            show: opts.labels !== "off",
            position: "right",
            color: p.ink,
            fontFamily: p.mono,
            fontSize: 12,
            formatter: (x: any) => {
              const s = stages[x.dataIndex];
              return mass ? `${num(s.mass_kg / 1000, 1)} t · ${pct(s.share_mass, 2)}` : `${num(s.count, s.name === "E3" ? 1 : 0)} · ${pct(s.share_count)}`;
            },
          },
        },
      ],
    },
  };
};

const reasons: Builder = (data, opts, p) => {
  const run = headlineRun(data.runs);
  const mass = opts.metric === "mass";
  const rows = (run.reasons as any[])
    .filter((r) => r.stage !== "E3" && (mass ? r.mass_kg : r.count) > 0)
    .sort((a, b) => (mass ? b.mass_kg - a.mass_kg : b.count - a.count));
  return {
    height: 60 + rows.length * 38,
    table: {
      columns: [["reason", "Ausschlussgrund"], ["stage", "Stufe"], ["count", "Nutzlasten", "right"], ["mass", "Masse", "right"]],
      rows: rows.map((r) => ({ reason: REASON_LABEL[r.reason] ?? r.reason, stage: r.stage, count: num(r.count), mass: `${num(r.mass_kg / 1000, 1)} t` })),
    },
    option: {
      grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        inverse: true,
        data: rows.map((r) => REASON_LABEL[r.reason] ?? r.reason),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: p.mist, fontSize: 13 },
      },
      series: [
        {
          type: "bar",
          barWidth: "56%",
          // Ein Akzent: der größte Block der Marktgrenze (E2), alles Technische grau.
          data: rows.map((r) => ({ value: mass ? r.mass_kg / 1000 : r.count, itemStyle: { color: r.reason === "CAPTIVE" ? p.accent : p.muted } })),
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => (mass ? `${num(x.value, 0)} t` : num(x.value)) },
        },
      ],
    },
  };
};

// --------------------------------------------------------------------------- Frage 2: Standorte

const STATUS_LABEL: Record<string, string> = {
  operativ: "aktiv",
  vertrag: "Vertrag",
  term_sheet: "Term Sheet",
  option: "Option",
  kein_bezug: "kein Bezug",
};
export const statusLabel = (s: string | null | undefined) => (s ? STATUS_LABEL[s] ?? s : "–");

const SITE_METRIC: Record<string, { label: string; d: number }> = {
  e2_count: { label: "offen adressierbare Nutzlasten 2025", d: 0 },
  missions_per_year: { label: "gewinnbare Missionen pro Jahr", d: 1 },
  e2_extra_vs_andoya: { label: "zusätzlich ggü. Andøya", d: 0 },
};

function sitesOrdered(sites: any[], key: string, sort: string | undefined) {
  return sort === "value" ? [...sites].sort((a, b) => b[key] - a[key]) : sites;
}

const sitesBars: Builder = (data, opts, p) => {
  const key = opts.metric in SITE_METRIC ? opts.metric : "e2_count";
  const m = SITE_METRIC[key];
  const sites = sitesOrdered(data.sites.sites, key, opts.sort);
  const andoya = data.sites.sites.find((s: any) => s.id === "andoya");
  return {
    height: 70 + sites.length * 44,
    table: sitesTable(data, {}, p).table,
    option: {
      grid: { left: 8, right: 64, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: "value", show: false, max: (v: { max: number }) => v.max * 1.04 },
      yAxis: {
        type: "category",
        inverse: true,
        data: sites.map((s: any) => s.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 13,
          formatter: (label: string, i: number) => `{n|${label}}\n{s|${statusLabel(sites[i].isar_status)}}`,
          rich: { n: { color: p.ink, fontSize: 13, lineHeight: 18 }, s: { color: p.mist, fontFamily: p.mono, fontSize: 11, lineHeight: 15 } },
        },
      },
      series: [
        {
          type: "bar",
          barWidth: "52%",
          data: sites.map((s: any) => ({ value: s[key], itemStyle: { color: s.id === "andoya" ? p.accent : p.muted } })),
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => num(x.value, m.d) },
          markLine:
            key === "e2_extra_vs_andoya" || !andoya
              ? undefined
              : {
                  symbol: "none",
                  silent: true,
                  lineStyle: { color: p.accent, type: [4, 4], width: 1 },
                  label: { formatter: "Andøya", color: p.accent, fontFamily: p.mono, fontSize: 11, position: "start" },
                  data: [{ xAxis: andoya[key] }],
                },
        },
      ],
    },
  };
};

const sitesReach: Builder = (data, _opts, p) => {
  const sites = data.sites.sites as any[];
  return {
    height: 90 + sites.length * 52,
    table: sitesTable(data, {}, p).table,
    option: {
      grid: { left: 8, right: 64, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, data: ["Technisch erreichbar", "Offen adressierbar"] },
      xAxis: { type: "value", show: false, max: 1 },
      yAxis: { type: "category", inverse: true, data: sites.map((s) => s.label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.ink, fontSize: 13 } },
      series: [
        {
          name: "Technisch erreichbar",
          type: "bar",
          barGap: "15%",
          data: sites.map((s) => s.e1_share_count),
          itemStyle: { color: p.muted },
          label: { show: true, position: "right", color: p.mist, fontFamily: p.mono, fontSize: 11, formatter: (x: any) => pct(x.value, 0) },
        },
        {
          name: "Offen adressierbar",
          type: "bar",
          data: sites.map((s) => s.e2_share_count),
          itemStyle: { color: p.accent },
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 11, formatter: (x: any) => pct(x.value, 1) },
        },
      ],
    },
  };
};

const sitesTable: Builder = (data) => ({
  table: {
    columns: [
      ["site", "Startplatz"],
      ["window", "Fenster"],
      ["status", "Status Isar"],
      ["e1", "Technisch erreichbar", "right"],
      ["e2", "Offen adressierbar", "right"],
      ["extra", "Neu ggü. Andøya", "right"],
      ["missions", "Missionen/Jahr", "right"],
    ],
    rows: (data.sites.sites as any[]).map((s) => ({
      site: s.label,
      window: `${num(s.inc_min, s.inc_min % 1 ? 1 : 0)} bis ${num(s.inc_max)}°`,
      status: statusLabel(s.isar_status),
      e1: pct(s.e1_share_count),
      e2: num(s.e2_count),
      extra: s.id === "andoya" ? "–" : s.e2_extra_vs_andoya ? `+${num(s.e2_extra_vs_andoya)}` : "0",
      missions: num(s.missions_per_year, 1),
    })),
  },
});

export const KINDS: Record<string, Builder> = {
  funnel,
  "funnel-table": (data) => ({ table: funnelTable(headlineRun(data.runs)) }),
  reasons,
  "sites-bars": sitesBars,
  "sites-reach": sitesReach,
  "sites-table": sitesTable,
};

/** Optionen einer Ansicht: Vorgaben aus charts.json, überschrieben durch die Wahl im Eckmenü. */
export function viewOptions(view: ViewSpec, overrides: Record<string, string> = {}): Record<string, string> {
  return { ...(view.options ?? {}), ...overrides };
}

/** Prüft charts.json gegen die bekannten Bausteine. Leere Liste = in Ordnung. */
export function validateCharts(file: ChartsFile): string[] {
  const errors: string[] = [];
  for (const [id, panel] of Object.entries(file.panels)) {
    if (!panel.views?.length) errors.push(`${id}: keine Ansicht`);
    if (!panel.views?.some((v) => !v.backup)) errors.push(`${id}: keine Hauptansicht`);
    const seen = new Set<string>();
    for (const v of panel.views ?? []) {
      if (!(v.kind in KINDS)) errors.push(`${id}/${v.id}: unbekannter Baustein ${v.kind}`);
      if (seen.has(v.id)) errors.push(`${id}/${v.id}: Ansicht doppelt`);
      seen.add(v.id);
      for (const c of v.controls ?? []) {
        const opt = v.options?.[c.key];
        if (opt !== undefined && !c.values.some(([val]) => val === opt)) errors.push(`${id}/${v.id}: Vorgabe ${c.key}=${opt} nicht in den Werten`);
      }
    }
  }
  return errors;
}
