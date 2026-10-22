// Reine Geometrie für die Szene. Kugel mit Radius 1 = Erdradius; y zeigt nach Norden.

export const EARTH_RADIUS_KM = 6371.0088;
const D2R = Math.PI / 180;

export type Vec3 = [number, number, number];

/** WGS84-Breite/Länge auf die Einheitskugel (Kugelnäherung, für Darstellung ausreichend). */
export function latLonToVec(lat: number, lon: number, r = 1): Vec3 {
  const la = lat * D2R;
  const lo = lon * D2R;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** Zielpunkt bei Peilung (Grad, rechtweisend Nord) und Distanz (km) auf der Kugel. */
export function destination(lat: number, lon: number, bearingDeg: number, distKm: number): [number, number] {
  const d = distKm / EARTH_RADIUS_KM;
  const b = bearingDeg * D2R;
  const la1 = lat * D2R;
  const lo1 = lon * D2R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [la2 / D2R, ((lo2 / D2R + 540) % 360) - 180];
}

/** Großkreisdistanz in km (Haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLa = (lat2 - lat1) * D2R;
  const dLo = (lon2 - lon1) * D2R;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLo / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Fächer (Sektor) als Polylinie: Pad → Bogen von a0 bis a1 → Pad. */
export function sectorOutline(lat: number, lon: number, a0: number, a1: number, radiusKm: number, steps = 48): [number, number][] {
  const pts: [number, number][] = [[lat, lon]];
  const span = (((a1 - a0) % 360) + 360) % 360 || 360;
  for (let i = 0; i <= steps; i++) pts.push(destination(lat, lon, a0 + (span * i) / steps, radiusKm));
  pts.push([lat, lon]);
  return pts;
}

/** Ausdehnung einer Linie (Diagonale der Hülle, km); zum Ausblenden winziger Küstenringe. */
export function extentKm(coords: [number, number][]): number {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lon, lat] of coords) {
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return coords.length ? distanceKm(s, w, n, e) : 0;
}

/** Julianisches Datum aus UTC-Zeitpunkt. */
export function julianDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Mittlere Greenwich-Sternzeit in Grad (IAU 1982, für Darstellung genau genug). */
export function gmstDeg(d: Date): number {
  const t = julianDate(d) - 2451545.0;
  return (((280.46061837 + 360.98564736629 * t) % 360) + 360) % 360;
}

/** Subsolarer Punkt (Breite, Länge in Grad) nach NOAA-Näherung, Genauigkeit etwa 0,1°. */
export function subsolarPoint(d: Date): [number, number] {
  const n = julianDate(d) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  // Länge des Bildpunkts: Rektaszension minus Sternzeit
  const lon = ((((ra / D2R - gmstDeg(d)) % 360) + 540) % 360) - 180;
  return [dec / D2R, lon];
}

/** Stern (Rektaszension, Deklination in Grad) als Richtung im erdfesten Rahmen zu einem Zeitpunkt. */
export function starDirection(raDeg: number, decDeg: number, d: Date): Vec3 {
  return latLonToVec(decDeg, raDeg - gmstDeg(d));
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export interface CameraPose {
  lat: number;
  lon: number;
  /** Höhe über Grund in Erdradien. */
  alt: number;
  /** Neigung aus der Senkrechten in Grad (0 = senkrecht nach unten). */
  tilt: number;
  /** Blickrichtung der Neigung (Peilung, Grad). */
  heading: number;
}

export interface FlightSpec {
  start: { lat: number; lon: number; alt: number };
  target: { lat: number; lon: number; alt: number; tilt: number; heading: number };
}

/**
 * Kamerapfad als eine durchgehende Bewegung: Höhe logarithmisch, Ort folgt früh,
 * Neigung erst am Ende. t in [0, 1].
 */
export function flightPose(spec: FlightSpec, t: number): CameraPose {
  const tt = clamp01(t);
  const e = easeInOutCubic(tt);
  const la = Math.log(spec.start.alt);
  const lb = Math.log(spec.target.alt);
  const alt = Math.exp(la + (lb - la) * e);
  // Ortswechsel abgeschlossen, bevor die Kamera tief ist (sonst rast der Boden vorbei).
  const m = easeInOutCubic(clamp01(tt / 0.62));
  const lat = spec.start.lat + (spec.target.lat - spec.start.lat) * m;
  const lon = spec.start.lon + (spec.target.lon - spec.start.lon) * m;
  const tilt = spec.target.tilt * smoothstep(0.72, 1, tt);
  return { lat, lon, alt, tilt, heading: spec.target.heading };
}

/** Sichtbare Bodenbreite in km bei senkrechtem Blick (Näherung, flache Erde ab kleinen Höhen). */
export function footprintKm(altR: number, fovDeg: number, aspect: number): number {
  return 2 * altR * EARTH_RADIUS_KM * Math.tan((fovDeg * D2R) / 2) * aspect;
}
