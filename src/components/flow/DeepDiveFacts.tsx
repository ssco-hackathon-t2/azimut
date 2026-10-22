import type { Site, SitesCompare, Tables } from "@/lib/story";
import type { View } from "./Globe";
import { nf, num, val } from "./shared";

/** flow.json["deepdive"]: Texte der Deep-Dive-Seiten je Startplatz. {platzhalter} füllt der Code aus den Daten (fill). */
export interface DeepDiveData {
  zurueck: string;
  ui: {
    score: string;
    von: string;
    best: string;
    rang: string;
    stats: [string, string, string];
    zeilen: [string, string, string];
    markt: string;
    wie: string;
    fuss: string;
    offen: string;
    kacheln: string;
    uebersicht: string;
  };
  plaetze: Record<string, DeepDivePlatz>;
}

export interface DeepDivePlatz {
  titel: string;
  sub: string;
  note: string;
  orbits: string;
  ausbau: string;
  kern: string;
  wie: string[];
}

/** Globus-Übersicht über alle sechs Plätze (Nova Scotia bis Esrange, Kourou bis Andøya). */
export const OVERVIEW: View = { lat: 42, lon: -22, dist: 3.3 };
const DAYS = 365;

/** Felder aus sites_compare.json, die der Typ in story-core (noch) nicht kennt. */
type SiteRow = Site & { permitted_launches_per_year?: string };
interface Extra {
  factors: { factors: { id: string }[]; values: { site: string; factor: string; score: number; raw: number | null }[] };
  portfolios: { meta: Record<string, { base: number }>; items: { sites: string[]; after_failure?: number }[] };
}

/** {name} durch vars[name] ersetzen; unbekannte Platzhalter bleiben sichtbar stehen. */
export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

const nf1 = (n: number) => nf(n, Number.isInteger(n) ? 0 : 1);
export const coord = (lat: number, lon: number) => `${nf(Math.abs(lat), 4)}° ${lat >= 0 ? "N" : "S"}  ${nf(Math.abs(lon), 4)}° ${lon >= 0 ? "E" : "W"}`;

/** Sechs Kriterien je Platz (factors) und gewichteter Mittelwert; Gewichte in der Reihenfolge von factors.factors. */
export function siteScore(sc: SitesCompare, id: string, weights: number[]) {
  const f = (sc as unknown as Extra).factors;
  const scores = f.factors.map((x) => f.values.find((v) => v.site === id && v.factor === x.id)?.score ?? NaN);
  const total = scores.reduce((a, v, i) => a + v * weights[i], 0) / weights.reduce((a, v) => a + v, 0);
  return { scores, total };
}

/**
 * Kernzahlen je Platz als formatierte Platzhalter: genehmigte Starts, Starts je Pad (365 × wetterfähige Tage ÷ Wendezeit),
 * gewinnbare Starts, zusätzliche offen adressierbare Nutzlasten ggü. Andøya, Neigungsfenster. Fehlt eine Angabe: „offen“.
 */
export function siteVars(sc: SitesCompare, id: string, offen: string) {
  const x = sc as unknown as Extra;
  const s = sc.sites.find((v) => v.id === id) as SiteRow | undefined;
  const wetter = num(x.factors.values.find((v) => v.site === id && v.factor === "wetter")?.raw ?? NaN);
  const pad = (DAYS * wetter) / num(x.portfolios.meta.turnaround_days_pad?.base);
  // Nur Andøya hat ein Ein-Platz-Portfolio (A); für die anderen gibt es keinen Wert „nach einem Fehlstart“.
  const solo = x.portfolios.items.find((p) => p.sites.length === 1 && p.sites[0] === id);
  const permitted = s?.permitted_launches_per_year ? num(s.permitted_launches_per_year) : NaN;
  const vars: Record<string, string> = {
    permitted: Number.isFinite(permitted) ? nf(permitted) : offen,
    pad: nf(pad, 1),
    // ponytail: zweiter Pad = doppelte Kadenz, gleiche Wetter- und Wendezeit-Annahme wie Pad 1.
    pad2: nf(pad * 2),
    market: nf(num(s?.missions_per_year), 1),
    extra: nf(num(s?.e2_extra_vs_andoya)),
    inc: s ? `${nf1(s.inc_min)}–${nf1(s.inc_max)}°` : offen,
    after_failure: solo?.after_failure != null ? nf(solo.after_failure) : offen,
    standdown: nf(num(x.portfolios.meta.standdown_months?.base)),
  };
  return { site: s, vars };
}

/** Deep Dive je Startplatz (Artboard DeepDive, rechte Spalte): Kennung, Resilienz-Score, Kennzahlen, Zeilen, Kernsatz, Weg zur Resilienz. */
export function DeepDiveFacts({
  id,
  d,
  name,
  tag,
  weights,
  sc,
  t,
}: {
  id: string;
  d: DeepDiveData;
  name: string;
  tag: string;
  weights: number[];
  sc: SitesCompare;
  t: Tables;
}) {
  const p = d.plaetze[id];
  const { vars } = siteVars(sc, id, d.ui.offen);
  const all = { ...vars, name };
  const f = (s: string) => fill(s, all);
  // Rangfolge „Resilienz zuerst“ über alle sechs Plätze.
  const rank = sc.sites.map((s) => ({ id: s.id, total: siteScore(sc, s.id, weights).total })).sort((a, b) => b.total - a.total);
  const pos = rank.findIndex((r) => r.id === id);
  const score = rank[pos]?.total ?? NaN;
  const sso = val(t, `site_orbit_access:${id}__sso:payload_factor_vs_leo`) * val(t, "launch_vehicles:spectrum:payload_leo_kg");
  const stats: [string, boolean][] = [
    [vars.permitted, false],
    [vars.pad, true],
    [`${nf(sso)} kg`, false],
  ];
  const zeilen = [f(p.orbits), f(d.ui.markt), f(p.ausbau)];

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[13px] tracking-[0.12em] text-mist-2">{tag}</span>
        <h1 className="text-[clamp(1.75rem,2.4vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.02em]">{p.titel}</h1>
        <span className="text-[16px] text-mist">{f(p.sub)}</span>
      </div>
      <div className="flex items-center gap-4 border border-rule-strong bg-night-2 px-4 py-3">
        <div className="flex shrink-0 flex-col items-start">
          <span className="text-[13px] text-mist">{d.ui.score}</span>
          <span className="text-[34px] font-bold leading-none">
            {nf(score, 1)}
            <span className="text-[16px] font-normal text-mist"> {d.ui.von}</span>
          </span>
        </div>
        <span className="text-[14px] leading-[1.4] text-mist">
          {pos === 0 ? d.ui.best : fill(d.ui.rang, { rank: nf(pos + 1) })} {f(p.note)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(([v, hl], i) => (
          <div key={d.ui.stats[i]} className={`flex flex-col gap-1 border p-3 ${hl ? "border-ice" : "border-rule-strong"}`}>
            <span className={`text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold leading-none ${hl ? "text-ice" : ""}`}>{v}</span>
            <span className="text-[13px] text-mist">{d.ui.stats[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-rule pt-4 text-[17px] leading-[1.35]">
        {d.ui.zeilen.map((l, i) => (
          <span key={l} className="contents">
            <span className="text-mist">{l}</span>
            <span>{zeilen[i]}</span>
          </span>
        ))}
      </div>
      <div className="border-l-[3px] border-red py-1.5 pl-3.5 text-[20px] font-semibold leading-[1.35]">{f(p.kern)}</div>
      <div className="flex flex-col gap-2">
        <span className="text-[14px] text-mist">{f(d.ui.wie)}</span>
        <ol className="flex flex-col gap-1.5 text-[15px] leading-[1.35]">
          {p.wie.map((w, i) => (
            <li key={w} className="flex gap-2.5">
              <b className="font-mono font-medium text-aurora">{i + 1}</b>
              <span>{f(w)}</span>
            </li>
          ))}
        </ol>
        <span className="text-[12px] leading-normal text-mist-2">{f(d.ui.fuss)}</span>
      </div>
    </div>
  );
}
