"use client";

import { asset } from "@/lib/data";
import { extentKm, sectorOutline } from "@/lib/geo";
import { fmtCoord } from "@/lib/format";
import type { GeoManifest } from "./OrbitScene";

interface OsmFeature {
  properties: { kind: string };
  geometry: { coordinates: [number, number][] };
}

const STROKE: Record<string, [string, number, number]> = {
  coastline: ["#8fd3ff", 0.75, 1.2],
  road: ["#a9b4c4", 0.55, 1],
  building: ["#e9edf2", 0.6, 0.8],
  tank: ["#e9edf2", 0.75, 0.8],
  fence: ["#8794a8", 0.45, 0.6],
  water: ["#8fd3ff", 0.4, 0.8],
  launchpad: ["#8fd3ff", 1, 1.8],
};

/**
 * Lageplan aus echten Daten: Sentinel-2-Ausschnitt (EPSG:4326-Raster, daher lineare Abbildung),
 * OSM-Geometrie und genehmigter Startsektor. Dient als statischer Fallback und auf der Standortseite.
 */
export function PadMap({
  geo,
  osm,
  sector,
  lod = "lod_4_5.jpg",
  className = "",
  showScale = true,
  graded = true,
  caption = true,
}: {
  geo: GeoManifest;
  osm?: { features: OsmFeature[] };
  sector: { min: number; max: number } | null;
  lod?: string;
  className?: string;
  showScale?: boolean;
  graded?: boolean;
  /** Nachweiszeile im Bild; aus, wenn die umgebende Seite sie schon zeigt. */
  caption?: boolean;
}) {
  const f = geo.files[lod];
  if (!f?.bounds_wsen) return null;
  const [w, s, e, n] = f.bounds_wsen;
  const W = 1000;
  const H = 1000;
  const x = (lon: number) => ((lon - w) / (e - w)) * W;
  const y = (lat: number) => ((n - lat) / (n - s)) * H;
  const path = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? "L" : "M"}${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join("");
  const km = f.km ?? 4.5;
  const radius = Math.min(km * 0.36, 3.4);
  const sec = sector ? sectorOutline(geo.pad.lat, geo.pad.lon, sector.min, sector.max, radius, 64).map(([la, lo]) => [lo, la] as [number, number]) : [];
  const barKm = km > 10 ? 5 : km > 3 ? 1 : 0.5;
  const barPx = (barKm / km) * W;
  const px = x(geo.pad.lon);
  const py = y(geo.pad.lat);
  const mid = sector ? sectorOutline(geo.pad.lat, geo.pad.lon, sector.min, sector.max, radius * 1.1, 2)[2] : null;

  return (
    <figure className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="img" aria-labelledby="padmap-t">
        <title id="padmap-t">
          Site plan Andøya Spaceport Pad A, Sentinel-2 imagery 2025 with OpenStreetMap geometry{sector ? ` and licensed launch sector ${sector.min}° to ${sector.max}°` : ""}.
        </title>
        <defs>
          <filter id="grade" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0.4" />
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude="0.7" exponent="1.18" offset="0.02" />
              <feFuncG type="gamma" amplitude="0.78" exponent="1.18" offset="0.03" />
              <feFuncB type="gamma" amplitude="0.92" exponent="1.18" offset="0.06" />
            </feComponentTransfer>
          </filter>
        </defs>
        <image href={asset(`geo/${lod}`)} x="0" y="0" width={W} height={H} preserveAspectRatio="none" filter={graded ? "url(#grade)" : undefined} />
        {sec.length > 0 && <path d={path(sec)} fill="rgba(126,224,181,0.08)" stroke="#7ee0b5" strokeWidth="1.4" strokeOpacity="0.9" />}
        {osm?.features.map((ft, i) => {
          const st = STROKE[ft.properties.kind];
          if (!st) return null;
          if (ft.properties.kind === "coastline" && extentKm(ft.geometry.coordinates) < km * 0.04) return null;
          return (
            <path
              key={i}
              d={path(ft.geometry.coordinates)}
              fill={ft.properties.kind === "launchpad" ? "rgba(143,211,255,0.18)" : "none"}
              stroke={st[0]}
              strokeOpacity={st[1]}
              strokeWidth={st[2]}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <circle cx={px} cy={py} r="5" fill="none" stroke="#e9edf2" strokeWidth="1.2" />
        {sector && mid && (
          <text x={x(mid[1])} y={y(mid[0])} fill="#7ee0b5" fontSize="22" textAnchor="middle" style={{ fontFamily: "var(--font-sans)" }}>
            Launch sector {sector.min}–{sector.max}°
          </text>
        )}
        {showScale && (
          <g transform={`translate(${W - barPx - 40}, ${H - 46})`}>
            <rect x="0" y="0" width={barPx} height="3" fill="#e9edf2" />
            <text x={barPx / 2} y="-8" fill="#e9edf2" fontSize="20" textAnchor="middle" style={{ fontFamily: "var(--font-mono)" }}>
              {barKm.toLocaleString("en-US")} km
            </text>
          </g>
        )}
        <g transform="translate(40, 46)" aria-hidden="true">
          <path d="M0,22 L8,0 L16,22 L8,16 Z" fill="#e9edf2" />
          <text x="8" y="44" fill="#e9edf2" fontSize="18" textAnchor="middle" style={{ fontFamily: "var(--font-mono)" }}>
            N
          </text>
        </g>
      </svg>
      <figcaption className={caption ? "absolute bottom-1 left-2 text-[0.7rem] text-mist" : "sr-only"}>
        <span className="sr-only">
          Pad A at {fmtCoord(geo.pad.lat, geo.pad.lon, 5)}, accuracy approx. {geo.pad.accuracy_m} m ({geo.pad.basis}).{" "}
        </span>
        {caption && "Contains modified Copernicus Sentinel data 2025 · © OpenStreetMap contributors"}
      </figcaption>
    </figure>
  );
}
