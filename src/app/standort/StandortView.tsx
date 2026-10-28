"use client";

import { useState } from "react";
import type { ConfigFile, DistributionsFile, Leaf, Manifest, RunsFile } from "@/lib/contract";
import { useAssetJSON, useJSON } from "@/lib/data";
import { distanceKm } from "@/lib/geo";
import { fmtCoord, fmtDate, fmtNum, fmtPct } from "@/lib/format";
import { PageHead, Section } from "@/components/shell/PageHead";
import { Ready } from "@/components/ui/States";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { PadMap } from "@/components/scene/PadMap";
import type { GeoManifest } from "@/components/scene/OrbitScene";
import { Distribution } from "@/components/charts/Distribution";
import { Toggle } from "@/components/ui/Toggle";

type OsmFC = { features: { properties: { kind: string }; geometry: { coordinates: [number, number][] } }[] };

export function StandortView() {
  const manifest = useJSON<Manifest>("manifest.json");
  const config = useJSON<ConfigFile>("config.json");
  const dist = useJSON<DistributionsFile>("distributions.json");
  const runs = useJSON<RunsFile>("runs.json");
  const geo = useAssetJSON<GeoManifest>("geo/manifest.json");
  const osm = useAssetJSON<OsmFC>("geo/pad_osm.json");
  return (
    <Ready items={[manifest, config, dist, runs, geo, osm] as const}>
      {(m, c, d, r, g, o) => <Standort manifest={m} config={c} dist={d} runs={r} geo={g} osm={o} />}
    </Ready>
  );
}

const SITE_FIELDS: [string, string][] = [
  ["status", "Status"],
  ["inc_min", "Inclination min."],
  ["inc_max", "Inclination max."],
  ["site_cap_per_year", "Launches/yr (licensed)"],
  ["site_cap_target", "Expansion target"],
  ["night_cap", "Night launches/yr"],
  ["first_launch_year", "First launch"],
  ["payload_cap_kg", "Payload class"],
  ["lease_until", "Lease until"],
];

function leafText(l?: Leaf): string {
  if (!l) return "–";
  const v = l.value;
  if (v === null || v === undefined) return "not sourced";
  if (typeof v === "number") {
    if (l.unit === "year" || (Number.isInteger(v) && v >= 1900 && v <= 2100)) return String(v);
    return `${fmtNum(v, Number.isInteger(v) ? 0 : 1)}${l.unit === "deg" ? "°" : l.unit === "kg" ? " kg" : ""}`;
  }
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${x}`).join(", ");
  return String(v);
}

function Standort({ config, dist, runs, geo, osm }: { manifest: Manifest; config: ConfigFile; dist: DistributionsFile; runs: RunsFile; geo: GeoManifest; osm: OsmFC }) {
  const [lod, setLod] = useState("lod_4_5.jpg");
  const andoya = config.sites?.andoya ?? {};
  const sector = (andoya.sector_deg as Leaf<{ min: number; max: number }> | undefined)?.value;
  const incMin = andoya.inc_min?.value as number | null | undefined;
  const incMax = andoya.inc_max?.value as number | null | undefined;
  const alt = (andoya.inc_window_alt as Leaf<{ inc_min: number; inc_max: number }> | undefined)?.value;
  const plannedLat = andoya.lat?.value as number | undefined;
  const plannedLon = andoya.lon?.value as number | undefined;
  const gap = plannedLat != null && plannedLon != null ? distanceKm(plannedLat, plannedLon, geo.pad.lat, geo.pad.lon) : null;
  const ssoKg = ((config.vehicles.spectrum?.payload_by_class as Leaf<Record<string, number>>)?.value ?? {}).SSO;
  const base = runs.runs.find((r) => r.run_id === dist.run_id);
  const e1 = base?.stages.find((s) => s.name === "E1");
  const lodFile = geo.files[lod];

  return (
    <>
      <PageHead title="Site" />
      <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
        <ProvenanceNote p={runs.provenance} />
      </div>

      <Section id="lageplan" title="Site plan Pad A">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-3">
              <Toggle
                label="Extent"
                options={[
                  ["lod_14.jpg", "14 km"],
                  ["lod_4_5.jpg", "4.5 km"],
                  ["lod_1_5.jpg", "1.5 km"],
                ]}
                value={lod}
                onChange={setLod}
              />
            </div>
            <PadMap geo={geo} osm={osm} sector={sector ?? null} lod={lod} className="aspect-square w-full border border-rule" />
            <p className="mt-2 text-[0.82rem] text-mist">
              Sentinel-2 L2A, acquired {(lodFile?.acquired ?? []).map((d) => fmtDate(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`)).join(", ")}, 10 m
              resolution, colors muted. Lines: OpenStreetMap. Fan: licensed launch sector, radius schematic.
            </p>
          </div>
          <dl className="grid content-start gap-x-6 gap-y-4 text-[0.95rem] sm:grid-cols-[auto_1fr]">
            <dt className="text-mist">Coordinates Pad A</dt>
            <dd className="metric text-[0.9rem] text-snow">{fmtCoord(geo.pad.lat, geo.pad.lon, 5)}</dd>
            <dt className="text-mist">Accuracy</dt>
            <dd>
              approx. ±{geo.pad.accuracy_m} m; {geo.pad.basis}. No official coordinate published.
            </dd>
            <dt className="text-mist">Launch sector</dt>
            <dd>
              {sector
                ? `${sector.min}–${sector.max}° (operating license 22 Aug 2024, source ${andoya.sector_deg?.source?.replace(/^https?:\/\//, "") ?? "–"}). The Andøya Space brochure states 300° to 005°; the license prevails.`
                : "not delivered"}
            </dd>
            <dt className="text-mist">Inclination window</dt>
            <dd>
              {incMin != null && incMax != null ? `${incMin}–${incMax}° base` : "Window not sourced"}
              {alt ? `, ${alt.inc_min}–${alt.inc_max}° alternative window` : ""}
              {andoya.inc_window_source?.value ? ` (${String(andoya.inc_window_source.value)})` : ""}
            </dd>
            <dt className="text-mist">Cross-check with model data</dt>
            <dd>
              {gap != null ? (
                <>
                  <span className="text-amber">config/sites.yaml</span> lists {fmtCoord(plannedLat!, plannedLon!, 1)} as the planning value; the actual pad is{" "}
                  {fmtNum(gap, 1)} km away. This has no effect on the calculation; the display uses the verified pad coordinate.
                </>
              ) : (
                "No site coordinate delivered in config/sites.yaml."
              )}
            </dd>
          </dl>
        </div>
      </Section>

      <Section
        id="fenster"
        title="Inclination of E0 payloads"
        intro={`Base year 2025, all payloads (${fmtNum(dist.inc_deg.e0_rows_with_inc)} of ${fmtNum(dist.inc_deg.e0_rows)} with known inclination). The window accounts for most of the exclusion before E1.`}
      >
        <Distribution
          edges={dist.inc_deg.edges}
          counts={dist.inc_deg.e0_count}
          xName="Inclination [°]"
          label="Histogram of inclination for all payloads launched in 2025, with active window 90 to 108 degrees."
          bands={[
            ...(alt ? [{ from: alt.inc_min, to: alt.inc_max, name: "" }] : []),
            ...(incMin != null && incMax != null ? [{ from: incMin, to: incMax, name: "active window", strong: true }] : []),
          ]}
        />
        {e1 && (
          <p className="mt-3 text-[0.92rem] text-mist">
            Technically reachable (E1, also mass and altitude): <span className="num text-snow">{fmtPct(e1.share_count, 2)}</span> of payloads,{" "}
            <span className="num text-snow">{fmtPct(e1.share_mass, 2)}</span> of mass.{alt ? ` Dotted: alternative window ${alt.inc_min}–${alt.inc_max}°.` : ""}
          </p>
        )}
      </Section>

      <Section id="masse" title="Mass of E0 payloads" intro="Logarithmic bins. The line marks the usable Spectrum SSO payload from vehicles.yaml.">
        <Distribution
          edges={dist.mass_kg.edges}
          counts={dist.mass_kg.e0_count}
          xName="Mass [kg] (log)"
          log
          label="Histogram of 2025 payload mass with Spectrum SSO threshold and smallsat limit."
          lines={[
            ...(ssoKg ? [{ at: ssoKg, name: `Spectrum SSO ${fmtNum(ssoKg)} kg` }] : []),
            { at: 1200, name: "Smallsat 1,200 kg", dashed: true },
          ]}
        />
      </Section>

      <Section id="vergleich" title="Site comparison" intro="Fields from config/sites.yaml, unmodified. Without a sourced window, the engine does not compute a site.">
        <div className="overflow-x-auto">
          <table className="stack-sm num w-full border-collapse text-left text-[0.92rem] md:min-w-[720px]">
            <thead className="text-mist">
              <tr className="border-b border-rule">
                <th className="py-2 pr-4 font-normal">Field</th>
                {Object.keys(config.sites ?? {}).map((id) => (
                  <th key={id} className="py-2 pr-4 font-normal text-snow">
                    {String(config.sites[id].name?.value ?? id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SITE_FIELDS.map(([k, label]) => (
                <tr key={k} className="border-b border-rule/50">
                  <td className="py-2 pr-4 text-snow md:text-mist">{label}</td>
                  {Object.keys(config.sites ?? {}).map((id) => {
                    const l = config.sites[id][k];
                    return (
                      <td key={id} className="py-2 pr-4" title={l?.source} data-label={String(config.sites[id].name?.value ?? id)}>
                        {leafText(l)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
