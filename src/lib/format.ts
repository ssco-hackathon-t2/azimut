// Deutsche Zahlformate wie app/common.py (fmt_num, fmt_pct, fmt_t, fmt_eur_mio). Reine Darstellung.

const nf = (d: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

export const DASH = "–";

const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

export function fmtNum(x: number | null | undefined, d = 0): string {
  return ok(x) ? nf(d).format(x) : DASH;
}

/** Anteil (0..1) als Prozent. */
export function fmtPct(x: number | null | undefined, d = 1): string {
  return ok(x) ? `${nf(d).format(x * 100)} %` : DASH;
}

export function fmtT(kg: number | null | undefined, d = 1): string {
  return ok(kg) ? `${nf(d).format(kg / 1000)} t` : DASH;
}

export function fmtEurMio(eur: number | null | undefined, d = 1): string {
  return ok(eur) ? `${nf(d).format(eur / 1e6)} Mio. €` : DASH;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Wert mit Engine-Einheit wie fmt_value in app/common.py. */
export function fmtValue(v: number | null | undefined, unit: string): string {
  switch (unit) {
    case "fraction":
      return fmtPct(v, 2);
    case "kg":
      return fmtT(v, 1);
    case "EUR":
      return fmtEurMio(v, 1);
    case "missions/year":
      return `${fmtNum(v, 1)} Missionen/Jahr`;
    case "flights":
      return `${fmtNum(v, 1)} Flüge`;
    case "count":
      return ok(v) && !Number.isInteger(v) ? fmtNum(v, 1) : fmtNum(v, 0);
    default:
      return ok(v) ? fmtNum(v, 2) : DASH;
  }
}

/** Rohwert aus YAML (Annahme, Vergleichswert) im deutschen Format; Jahre und Nicht-Zahlen unverändert. */
export function fmtRaw(v: unknown, unit?: string): string {
  if (typeof v !== "number") return v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
  if (unit === "year") return String(v);
  return fmtNum(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 4 : 2);
}

/** Erste URL in einer YAML-Quellenangabe (Quellen sind Freitext mit eingebetteten Links). */
export const urlOf = (s: string) => s.match(/https?:\/\/\S+?(?=[\s;,)]|$)/)?.[0];

/** Grad mit Hemisphäre für Koordinaten. */
export function fmtCoord(lat: number, lon: number, d = 4): string {
  const la = `${nf(d).format(Math.abs(lat))}° ${lat >= 0 ? "N" : "S"}`;
  const lo = `${nf(d).format(Math.abs(lon))}° ${lon >= 0 ? "O" : "W"}`;
  return `${la}  ${lo}`;
}
