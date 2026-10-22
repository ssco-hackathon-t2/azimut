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

// Diagramme laufen auf der englischen Startseite: englisches Zahlformat (1,000.5 und 8.9%), lib/format.ts bleibt deutsch.
const nf = (d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const num = (x: number, d = 0) => nf(d).format(x);
export const pct = (x: number, d = 1) => `${nf(d).format(x * 100)}%`;

/** Datenstatus (Schlüssel deutsch wie in den Daten-JSONs), Anzeige englisch wie lib/story-core.ts. */
export const DATA_STATUS: Record<string, string> = {
  belegt: "verified",
  abgeleitet: "derived",
  annahme: "assumption",
  team_annahme: "team assumption",
  unbestaetigt: "unconfirmed",
  widerspruechlich: "contradictory",
};
const dataStatus = (s: string | null | undefined) => (s ? DATA_STATUS[s] ?? s : "–");

// ponytail: Übersetzung der deutschen Freitexte aus sites_compare.json (Stand 22.10.2026), Schlüssel = deutscher Text.
// Ändert sich ein Text in den Daten, erscheint er wieder deutsch statt veraltet englisch; dauerhaft gehört ein
// englisches Feld in scripts/site_coverage.py. Namen wie „Andøya (NO)“ bleiben unverändert.
const TEXT_EN: Record<string, string> = {
  "Santa Maria, Azoren (PT)":
    "Santa Maria, Azores (PT)",
  "Neigungsfenster / Markt":
    "Inclination window / market",
  "Nutzlast":
    "Payload",
  "Wetter":
    "Weather",
  "Geopolitik / Recht":
    "Geopolitics / law",
  "Kosten":
    "Cost",
  "Kapazität / Reife":
    "Capacity / maturity",
  "Nur Andøya":
    "Andøya only",
  "+ SaxaVord (Ersatz ohne Norwegen)":
    "+ SaxaVord (replacement without Norway)",
  "Alle sechs":
    "All six",
  "Fabrik (Auslegung)":
    "Factory (design capacity)",
  "Genehmigte Starts an den Standorten":
    "Licensed launches at the sites",
  "Standortgenehmigung für alle Betreiber; fehlende Werte nicht gezählt":
    "Site licence for all operators; missing values not counted",
  "Rampen, wetterbereinigt":
    "Pads, weather-adjusted",
  "Je Standort eine Rampe: 365 x wetterfähige Tage / 30 Tage zwischen zwei Starts":
    "One pad per site: 365 x weather-capable days / 30 days between two launches",
  "Isar-Hochlauf 2030 (Plan-Deckel)":
    "Isar ramp-up 2030 (plan cap)",
  "Gewinnbare Nachfrage 2030":
    "Winnable demand 2030",
  "engine/multisite.py, Basis 2030, ohne Doppelzählung":
    "engine/multisite.py, base 2030, no double counting",
  "Je Standort eine Rampe: 365 x wetterfähige Tage / 7 Tage zwischen zwei Starts":
    "One pad per site: 365 x weather-capable days / 7 days between two launches",
  "Je Standort eine Rampe: 365 x wetterfähige Tage / 90 Tage zwischen zwei Starts":
    "One pad per site: 365 x weather-capable days / 90 days between two launches",
  "Faktor relativ zu 1.000 kg LEO; nur SSO = 0,70 ist Isar-Angabe, Rest physikalische Schaetzung":
    "Factor relative to 1,000 kg LEO; only SSO = 0.70 is an Isar figure, the rest is a physical estimate",
  "Faktor relativ zu 1.000 kg LEO, physikalische Schaetzung analog Andoya. Neigung aus cos i = cos(Breite) x sin(Azimut).":
    "Factor relative to 1,000 kg LEO, physical estimate analogous to Andøya. Inclination from cos i = cos(latitude) x sin(azimuth).",
  "Faktor relativ zu 1.000 kg LEO, physikalische Schaetzung analog Andoya. Neigung aus cos i = cos(Breite) x sin(Azimut). Per Dogleg aus 346 bis 350 Grad, etwas Verlust":
    "Factor relative to 1,000 kg LEO, physical estimate analogous to Andøya. Inclination from cos i = cos(latitude) x sin(azimuth). Dogleg from 346 to 350 degrees, some loss",
  "Faktor relativ zu 1.000 kg LEO, physikalische Schaetzung. SSO nach Sueden ueber den Atlantik.":
    "Factor relative to 1,000 kg LEO, physical estimate. SSO southbound over the Atlantic.",
  "Mittelwind 12 kn, mittlere Boeen ca. 25 kn liegen nahe der aus dem Scrub am 04.09.2026 (24 kn) abgeleiteten Spectrum-Bodenwindgrenze von ca. 20 bis 24 kn. Herbst/Winter mit Stuermen und Vereisung schlechter, Sommer besser. Belege: Flug 1 rund 6 Tage Windverzug, Flug 2 mindestens 2 Windabbrueche. Keine Tagesstatistik, daher Experteneinschaetzung.":
    "Mean wind 12 kn, mean gusts about 25 kn, close to the Spectrum ground wind limit of about 20 to 24 kn derived from the scrub on 4 Sep 2026 (24 kn). Autumn/winter worse with storms and icing, summer better. Evidence: flight 1 about 6 days of wind delay, flight 2 at least 2 wind scrubs. No daily statistics, hence expert estimate.",
  "Treiber: Hurrikansaison Juni bis November (3 bis 4 Ereignisse pro Jahr fuer Kanada), Winterstuerme und Vereisung, Nebel an ca. 115 Tagen (Sicht, Bahnverfolgung, Seeraum). Keine Windstatistik fuer Canso, daher weite Spanne.":
    "Drivers: hurricane season June to November (3 to 4 events per year for Canada), winter storms and icing, fog on about 115 days (visibility, tracking, sea area). No wind statistics for Canso, hence a wide range.",
  "Bodenwind praktisch nie limitierend (Maximum 83 km/h seit 1968), kein Hurrikanrisiko. Treiber sind Gewitter/Starkregen in der Regenzeit (191 Niederschlagstage, 80 mit >= 10 mm) und Hoehenwinde Mitte Juni bis Mitte August (Vega VV16 rund 13 Tage Wartezeit). Gewittertage sind eine Luecke.":
    "Ground wind practically never limiting (maximum 83 km/h since 1968), no hurricane risk. Drivers are thunderstorms/heavy rain in the rainy season (191 days with precipitation, 80 with >= 10 mm) and upper-level winds from mid June to mid August (Vega VV16 waited about 13 days). Thunderstorm days are a gap.",
  "High = Betreiberangabe 95 Prozent der Tage mit 3-h-Fenster unter 30 kn in Fruehjahr/Herbst, abgeschlagen fuer Winter und fuer eine strengere Spectrum-Grenze (ca. 20 bis 24 kn). Base wie Andoya, da aehnliche Nordatlantik-Lage; 204 Regentage. Betreiberzahl nicht unabhaengig geprueft.":
    "High = operator figure of 95% of days with a 3 h window below 30 kn in spring/autumn, discounted for winter and for a stricter Spectrum limit (about 20 to 24 kn). Base as Andøya, given a similar North Atlantic location; 204 rain days. Operator figure not independently verified.",
  "Binnenlandlage mit vermutlich weniger Bodenwind als die Kuestenplaetze (Luecke: keine Windstatistik). Treiber sind Kaelte bis -42 C und Vereisung (Schneedecke Ende Sept. bis Mitte Mai), Hoehenwinde und Sommergewitter. Beleg Windabbruch BROR 2023 mit 1 Tag Verzug.":
    "Inland location with probably less ground wind than the coastal sites (gap: no wind statistics). Drivers are cold down to -42 C and icing (snow cover from late Sept. to mid May), upper-level winds and summer thunderstorms. Evidence: wind scrub BROR 2023 with 1 day of delay.",
  "Mittelwind 11 kn, aber mittlere Boeen 27 kn (Atlantiklage). Sommer sehr guenstig (Juni/Juli je 4 Regentage), Winter mit Atlantiktiefs schlechter, seltene Hurrikane (Gordon 2012). Keine Kampagnenerfahrung, daher Experteneinschaetzung.":
    "Mean wind 11 kn, but mean gusts 27 kn (Atlantic location). Summer very favourable (June/July 4 rain days each), winter worse with Atlantic lows, rare hurricanes (Gordon 2012). No campaign experience, hence expert estimate.",
  "Regime in Kraft, Isar zweimal gestartet, Staat Mehrheitseigner, Verteidigung finanziert Pad 2, NATO; Abzug im Low-Fall fuer Sabotageverdacht, Militaernaehe und Single Point of Failure im Case-Schock":
    "Regime in force, Isar has launched twice, state is majority owner, defence funds pad 2, NATO; deduction in the low case for suspected sabotage, military proximity and single point of failure in the case shock",
  "Vertrag und DND/NATO-Anker, aber C-28 nicht in Kraft (Royal Assent eher 2027), Notfall-Stoppbefugnis, lokale Opposition, Abhaengigkeit TKMS-Abschluss":
    "Contract and DND/NATO anchor, but C-28 not in force (Royal Assent more likely 2027), emergency stop powers, local opposition, dependence on the TKMS deal",
  "EU-Boden, etabliertes franzoesisches Regime und ESA-Rahmen; Abzug fuer Vorrang Ariane 6/Vega-C, nur Term Sheet, Streik-Praezedenz 2017, Unterstuetzung lokaler Regierungen noetig":
    "EU soil, established French regime and ESA framework; deduction for Ariane 6/Vega-C priority, term sheet only, strike precedent 2017, support of local governments needed",
  "Space Industry Act 2018 und Spaceport-/Range-Lizenz in Kraft, NATO, UK-DE-Erklaerung 08.10.2026; aber UK nicht EU, Startlizenz je Betreiber (RFA-Meereslizenz 31 Monate), Gefahrengebiet bis nahe Jan Mayen, Fischerei":
    "Space Industry Act 2018 and spaceport/range licence in force, NATO, UK-DE declaration 8 Oct 2026; but UK not EU, launch licence per operator (RFA marine licence 31 months), hazard area reaching near Jan Mayen, fisheries",
  "EU und NATO, starker Staatsrueckhalt; aber neue Rymdlag fehlt und orbitale Flugbahn braucht norwegische Zustimmung je Start, Norwegen skeptisch; bei Norwegen-Sperre kaum nutzbar":
    "EU and NATO, strong state backing; but the new space act (Rymdlag) is missing and the orbital trajectory needs Norwegian consent for each launch, Norway sceptical; hardly usable if Norway blocks",
  "EU und NATO, Spaceport-Lizenz 2025 in Kraft; aber jede Operation einzeln zu genehmigen, INNOSPACE-Vorrang bis 2030, politische Kritik auf den Azoren, kein Isar-Bezug":
    "EU and NATO, spaceport licence in force since 2025; but every operation needs individual approval, INNOSPACE priority until 2030, political criticism in the Azores, no link to Isar",
  "Pad bestehend und mit NOK 200 Mio. oeffentlich gefoerdert, kurze Strassenlogistik 5 bis 8 Tage; Pacht und Gebuehren unveroeffentlicht":
    "Existing pad, publicly funded with NOK 200m, short road logistics of 5 to 8 days; lease and fees unpublished",
  "Hohe Fixgebuehr ca. 10 Mio. EUR/Jahr unabhaengig von Kadenz plus cost-plus-Startgebuehren und Transatlantik-Logistik ab 14 Tage See; 30 Monate Gebuehrenverzicht mildert Anlauf":
    "High fixed fee of about EUR 10m/year regardless of cadence, plus cost-plus launch fees and transatlantic logistics from 14 days at sea; 30-month fee waiver eases the start",
  "Gemeinsame Infrastruktur staatlich (50 Mio. EUR), aber eigener Isar-Pad noetig (PLD-Referenz 35 Mio. EUR, ungeprueft) und Seefracht ca. 10 bis 21 Tage":
    "Shared infrastructure state funded (EUR 50m), but a dedicated Isar pad is needed (PLD reference EUR 35m, unverified) and sea freight of about 10 to 21 days",
  "Neuer Pad noetig (Fredo exklusiv RFA), Infrastruktur teils oeffentlich gefoerdert (Pathfinder 23,5 Mio. GBP), Logistik ca. 6,5 Tage inkl. Faehren; Gebuehren Luecke":
    "New pad needed (Fredo exclusive to RFA), infrastructure partly publicly funded (Pathfinder GBP 23.5m), logistics about 6.5 days incl. ferries; fees are a gap",
  "Neuer Pad noetig, aber Isar-Teststandort und Transportkette vorhanden (Synergie Abnahme und Start), Strasse ca. 5 Tage, Staat kapitalisiert SSC; Gebuehren Luecke":
    "New pad needed, but Isar test site and transport chain in place (synergy between acceptance testing and launch), road about 5 days, state capitalises SSC; fees are a gap",
  "Neuer Pad und unreife Infrastruktur, Inselstandort mit Seetransport; keinerlei Kosten- oder Gebuehrendaten":
    "New pad and immature infrastructure, island site with sea transport; no cost or fee data at all",
  "Einziger Standort mit Spectrum-Orbitalflug, exklusiver Pad, bis 30 Starts/Jahr; Low wegen nur einem Pad, 4 Nachtstarts und Wind-Scrubs":
    "Only site with a Spectrum orbital flight, exclusive pad, up to 30 launches/year; low case because of a single pad, 4 night launches and wind scrubs",
  "Vertrag, SOW und Pad-Uebergabe 01.11.2026, Erststart 2028 geplant; Umweltgenehmigung nur 8/Jahr, Standort ohne Orbitalstart und mit minimaler Infrastruktur":
    "Contract, SOW and pad handover 1 Nov 2026, first launch planned for 2028; environmental permit only 8/year, site without an orbital launch and with minimal infrastructure",
  "Reifste Range Europas (CSG 30 bis 40 Starts/Jahr), Isar-Pad bis 10/Jahr geplant; aber nur Term Sheet, kein Isar-Bau, Range-Vorrang Ariane/Vega":
    "Most mature range in Europe (CSG 30 to 40 launches/year), Isar pad planned for up to 10/year; but term sheet only, no Isar construction, range priority for Ariane/Vega",
  "Lizenzierter Spaceport bis 30/Jahr mit freien Pad-Plaetzen (Orbex insolvent), aber noch kein Orbitalstart, kein Isar-Vertrag; Erststart Isar fruehestens 2029":
    "Licensed spaceport for up to 30/year with free pad slots (Orbex insolvent), but no orbital launch yet, no Isar contract; first Isar launch 2029 at the earliest",
  "LC-3C fuer Firefly im Bau, Orbitalstart fruehestens 2028, kein Isar-Startrecht oder Pad; Plus: Isar-Teststandort vor Ort":
    "LC-3C for Firefly under construction, orbital launch 2028 at the earliest, no Isar launch rights or pad; plus: Isar test site on location",
  "Nur suborbitale Starts bisher, INNOSPACE priorisiert, Orbital fruehestens 2027, kein Isar-Bezug":
    "Only suborbital launches so far, INNOSPACE prioritised, orbital 2027 at the earliest, no link to Isar",
};
/** Englische Fassung eines deutschen Daten-Textes; Unbekanntes bleibt, wie es ist. */
export const en = (s: string) => TEXT_EN[s] ?? s;

// --------------------------------------------------------------------------- Frage 1: Trichter

const STAGE_LABEL: Record<string, string> = {
  E0: "All payloads 2025",
  E1: "Technically reachable",
  E2: "Openly addressable",
  E3: "Winnable",
};
const REASON_LABEL: Record<string, string> = {
  ORBIT_UNKNOWN: "Orbit unknown",
  INC_OUT: "Inclination out of range",
  ALT_OUT: "Altitude out of range",
  MASS_OUT: "Too heavy for Spectrum",
  CAPTIVE: "Captive (own launcher)",
  GEO_BLOCK: "China, Russia, other",
  US_NATSEC: "US national security",
  WINRATE: "Competition (win rate)",
  CAPACITY: "Capacity",
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
    columns: [["stage", "Stage"], ["count", "Payloads", "right"], ["share_count", "Share", "right"], ["mass", "Mass", "right"], ["share_mass", "Share of mass", "right"]],
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
        axisLabel: { color: p.mist, fontSize: 13, width: 150, overflow: "break" },
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
      columns: [["reason", "Exclusion reason"], ["stage", "Stage"], ["count", "Payloads", "right"], ["mass", "Mass", "right"]],
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
        axisLabel: { color: p.mist, fontSize: 13, width: 150, overflow: "break" },
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
  operativ: "active",
  vertrag: "contract",
  term_sheet: "term sheet",
  option: "option",
  kein_bezug: "no link",
};
export const statusLabel = (s: string | null | undefined) => (s ? STATUS_LABEL[s] ?? s : "–");

const SITE_METRIC: Record<string, { label: string; d: number }> = {
  e2_count: { label: "openly addressable payloads 2025", d: 0 },
  missions_per_year: { label: "winnable missions per year", d: 1 },
  e2_extra_vs_andoya: { label: "additional vs. Andøya", d: 0 },
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
        data: sites.map((s: any) => en(s.label)),
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
      legend: { top: 0, left: 0, data: ["Technically reachable", "Openly addressable"] },
      xAxis: { type: "value", show: false, max: 1 },
      yAxis: { type: "category", inverse: true, data: sites.map((s) => en(s.label)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.ink, fontSize: 13, width: 150, overflow: "break" } },
      series: [
        {
          name: "Technically reachable",
          type: "bar",
          barGap: "15%",
          data: sites.map((s) => s.e1_share_count),
          itemStyle: { color: p.muted },
          label: { show: true, position: "right", color: p.mist, fontFamily: p.mono, fontSize: 11, formatter: (x: any) => pct(x.value, 0) },
        },
        {
          name: "Openly addressable",
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
      ["site", "Launch site"],
      ["window", "Window"],
      ["status", "Isar status"],
      ["e1", "Technically reachable", "right"],
      ["e2", "Openly addressable", "right"],
      ["extra", "New vs. Andøya", "right"],
      ["missions", "Missions/year", "right"],
    ],
    rows: (data.sites.sites as any[]).map((s) => ({
      site: en(s.label),
      window: `${num(s.inc_min, s.inc_min % 1 ? 1 : 0)} to ${num(s.inc_max)}°`,
      status: statusLabel(s.isar_status),
      e1: pct(s.e1_share_count),
      e2: num(s.e2_count),
      extra: s.id === "andoya" ? "–" : s.e2_extra_vs_andoya ? `+${num(s.e2_extra_vs_andoya)}` : "0",
      missions: num(s.missions_per_year, 1),
    })),
  },
});

// --------------------------------------------------------------------------- Sechs Faktoren je Startplatz

/** Gewichtungen für die Gesamtnote; Schlüssel = Faktor-ID aus sites_compare.json. */
export const WEIGHTS: Record<string, Record<string, number>> = {
  gleich: { markt: 1, nutzlast: 1, wetter: 1, geopolitik: 1, kosten: 1, kapazitaet: 1 },
  markt: { markt: 3, nutzlast: 1, wetter: 1, geopolitik: 1, kosten: 1, kapazitaet: 1 },
  resilienz: { markt: 1, nutzlast: 1, wetter: 2, geopolitik: 3, kosten: 1, kapazitaet: 2 },
  kosten: { markt: 1, nutzlast: 1, wetter: 1, geopolitik: 1, kosten: 3, kapazitaet: 2 },
};

/** Gewichteter Mittelwert der vorhandenen Punkte; Lücken zählen nicht, werden aber gemeldet. */
export function siteTotals(sites: any, weights: Record<string, number>) {
  return (sites.sites as any[]).map((s) => {
    const vals = (sites.factors.values as any[]).filter((v) => v.site === s.id);
    let sum = 0;
    let w = 0;
    const missing: string[] = [];
    for (const v of vals) {
      const k = weights[v.factor] ?? 0;
      if (v.score === null || v.score === undefined) missing.push(v.factor);
      else {
        sum += k * v.score;
        w += k;
      }
    }
    return { id: s.id, label: en(s.label), status: s.isar_status, total: w ? sum / w : null, missing };
  });
}

const factorLabel = (sites: any, id: string) => en((sites.factors.factors as any[]).find((f) => f.id === id)?.label ?? id);

const factorHeatmap: Builder = (data, _opts, p) => {
  const s = data.sites;
  const factors = s.factors.factors as any[];
  const sites = s.sites as any[];
  const cells = (s.factors.values as any[]).map((v) => [
    factors.findIndex((f) => f.id === v.factor),
    sites.findIndex((x) => x.id === v.site),
    v.score === null ? "-" : Math.round(v.score * 10) / 10,
  ]);
  return {
    height: 90 + sites.length * 48,
    table: factorTable(data, {}, p).table,
    option: {
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      xAxis: { type: "category", data: factors.map((f) => en(f.label)), position: "bottom", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.mist, fontSize: 12, interval: 0, width: 90, overflow: "break" }, splitArea: { show: false } },
      yAxis: { type: "category", inverse: true, data: sites.map((x) => en(x.label)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.ink, fontSize: 13, width: 150, overflow: "break" } },
      visualMap: { show: false, min: 1, max: 5, inRange: { color: [p.muted, p.accent] } },
      series: [
        {
          type: "heatmap",
          data: cells,
          itemStyle: { borderColor: p.rule, borderWidth: 2 },
          label: { show: true, color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => (x.value[2] === "-" ? "gap" : num(x.value[2], 1)) },
        },
      ],
    },
  };
};

const factorTotal: Builder = (data, opts, p) => {
  const weights = WEIGHTS[opts.weights] ?? WEIGHTS.gleich;
  const rows = siteTotals(data.sites, weights);
  const sorted = opts.sort === "value" ? [...rows].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)) : rows;
  return {
    height: 70 + sorted.length * 44,
    table: {
      columns: [["site", "Launch site"], ["total", "Overall score (1 to 5)", "right"], ["missing", "Gaps"]],
      rows: sorted.map((r) => ({ site: r.label, total: r.total === null ? "–" : num(r.total, 2), missing: r.missing.map((f) => factorLabel(data.sites, f)).join(", ") || "none" })),
    },
    option: {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: "value", show: false, min: 0, max: 5 },
      yAxis: {
        type: "category",
        inverse: true,
        data: sorted.map((r) => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 13,
          formatter: (label: string, i: number) => `{n|${label}}\n{s|${statusLabel(sorted[i].status)}}`,
          rich: { n: { color: p.ink, fontSize: 13, lineHeight: 18 }, s: { color: p.mist, fontFamily: p.mono, fontSize: 11, lineHeight: 15 } },
        },
      },
      series: [
        {
          type: "bar",
          barWidth: "52%",
          data: sorted.map((r) => ({ value: r.total, itemStyle: { color: r.id === "andoya" ? p.accent : p.muted } })),
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => (x.value === null ? "–" : num(x.value, 2)) },
        },
      ],
    },
  };
};

const factorTable: Builder = (data) => {
  const s = data.sites;
  const label = (id: string) => en((s.sites as any[]).find((x) => x.id === id)?.label ?? id);
  return {
    table: {
      columns: [["site", "Launch site"], ["factor", "Factor"], ["raw", "Raw value", "right"], ["score", "Points", "right"], ["status", "Status"], ["note", "Rationale"]],
      rows: (s.factors.values as any[]).map((v) => ({
        site: label(v.site),
        factor: factorLabel(s, v.factor),
        raw: v.raw === null ? "gap" : num(v.raw, v.raw < 1.5 ? 2 : v.raw < 10 ? 1 : 0),
        score: v.score === null ? "–" : num(v.score, 1),
        status: dataStatus(v.status),
        note: en(v.note ?? "").slice(0, 140),
      })),
    },
  };
};

// --------------------------------------------------------------------------- Engpass-Kette 2030

const chain: Builder = (data, opts, p) => {
  const items = data.sites.portfolios.items as any[];
  const pf = items.find((x) => x.id === opts.portfolio) ?? items[0];
  // Variante je Wendezeit der Rampe (Tage zwischen zwei Starts), sonst die Vorgabe der Daten
  const v = pf.variants?.[opts.turnaround] ?? pf;
  const stages = (v.chain as any[]).filter((c) => c.value !== null && c.value !== undefined);
  const be = pf.break_even;
  return {
    height: 70 + stages.length * 46,
    table: {
      columns: [["stage", "Stage"], ["value", "Launches or missions per year", "right"], ["status", "Status"], ["note", "Note"]],
      rows: (v.chain as any[]).map((c) => ({ stage: en(c.label), value: c.value === null ? "gap" : num(c.value, 1), status: dataStatus(c.status), note: en(c.note ?? "") })),
    },
    option: {
      grid: { left: 8, right: 64, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: "value", show: false, max: (v: { max: number }) => v.max * 1.05 },
      yAxis: { type: "category", inverse: true, data: stages.map((c) => en(c.label)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.ink, fontSize: 13, width: 150, overflow: "break" } },
      series: [
        {
          type: "bar",
          barWidth: "52%",
          // Ein Akzent: die Stufe, die bindet (kleinster Wert der Kette)
          data: stages.map((c) => ({ value: c.value, itemStyle: { color: c.id === v.binding ? p.accent : p.muted } })),
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => num(x.value, 1) },
          markLine: be
            ? {
                symbol: "none",
                silent: true,
                lineStyle: { color: p.ink, type: [4, 4], width: 1 },
                label: { formatter: `Break-even ${num(be.base)}`, color: p.ink, fontFamily: p.mono, fontSize: 11, position: "start" },
                data: [{ xAxis: be.base }],
              }
            : undefined,
        },
      ],
    },
  };
};

const portfolioDemand: Builder = (data, _opts, p) => {
  const items = data.sites.portfolios.items as any[];
  const need = (x: any) => x.chain.find((c: any) => c.id === "nachfrage")?.value ?? null;
  const be = items[0]?.break_even;
  return {
    height: 70 + items.length * 44,
    table: {
      columns: [["pf", "Portfolio"], ["need", "Winnable missions 2030", "right"], ["be", "Break-even", "right"]],
      rows: items.map((x) => ({ pf: en(x.label), need: need(x) === null ? "–" : num(need(x), 1), be: be ? num(be.base) : "–" })),
    },
    option: {
      grid: { left: 8, right: 56, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: "value", show: false, min: 0, max: (v: { max: number }) => Math.max(v.max, be?.high ?? 0) * 1.05 },
      yAxis: { type: "category", inverse: true, data: items.map((x) => en(x.label)), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: p.ink, fontSize: 13, width: 150, overflow: "break" } },
      series: [
        {
          type: "bar",
          barWidth: "52%",
          data: items.map((x) => ({ value: need(x), itemStyle: { color: x.id === "A" ? p.accent : p.muted } })),
          label: { show: true, position: "right", color: p.ink, fontFamily: p.mono, fontSize: 12, formatter: (x: any) => num(x.value, 1) },
          markLine: be
            ? {
                symbol: "none",
                silent: true,
                lineStyle: { color: p.ink, type: [4, 4], width: 1 },
                label: { formatter: `Break-even ${num(be.base)}`, color: p.ink, fontFamily: p.mono, fontSize: 11, position: "start" },
                data: [{ xAxis: be.base }],
              }
            : undefined,
        },
      ],
    },
  };
};

export const KINDS: Record<string, Builder> = {
  "factor-heatmap": factorHeatmap,
  "factor-total": factorTotal,
  "factor-table": factorTable,
  chain,
  "portfolio-demand": portfolioDemand,
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
    if (!panel.views?.length) errors.push(`${id}: no view`);
    if (!panel.views?.some((v) => !v.backup)) errors.push(`${id}: no primary view`);
    const seen = new Set<string>();
    for (const v of panel.views ?? []) {
      if (!(v.kind in KINDS)) errors.push(`${id}/${v.id}: unknown chart kind ${v.kind}`);
      if (seen.has(v.id)) errors.push(`${id}/${v.id}: duplicate view`);
      seen.add(v.id);
      for (const c of v.controls ?? []) {
        const opt = v.options?.[c.key];
        if (opt !== undefined && !c.values.some(([val]) => val === opt)) errors.push(`${id}/${v.id}: default ${c.key}=${opt} is not among the values`);
      }
    }
  }
  return errors;
}
