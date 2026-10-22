"use client";

import { useState } from "react";
import type { ConfigFile, DistributionsFile, Leaf, Manifest, RunsFile } from "@/lib/contract";
import { useAssetJSON, useJSON } from "@/lib/data";
import { distanceKm } from "@/lib/geo";
import { fmtCoord, fmtNum, fmtPct } from "@/lib/format";
import { PageHead, Section } from "@/components/shell/PageHead";
import { OpenItem, Ready } from "@/components/ui/States";
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
  ["inc_min", "Inklination min."],
  ["inc_max", "Inklination max."],
  ["site_cap_per_year", "Starts/Jahr (Genehmigung)"],
  ["site_cap_target", "Ausbauziel"],
  ["night_cap", "Nachtstarts/Jahr"],
  ["first_launch_year", "Erster Start"],
  ["payload_cap_kg", "Nutzlastklasse"],
  ["lease_until", "Pacht bis"],
];

function leafText(l?: Leaf): string {
  if (!l) return "–";
  const v = l.value;
  if (v === null || v === undefined) return "unbelegt";
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
      <PageHead title="Standort">
        Andøya Spaceport, Pad A, an der Nordwestküste bei Nordmela (Børvågen). Lageplan aus echten Daten, darunter das technische Fenster
        und die Verteilungen, die den Schritt E0 → E1 bestimmen.
      </PageHead>
      <div className="mx-auto max-w-[88rem] px-4 sm:px-8">
        <ProvenanceNote p={runs.provenance} />
      </div>

      <Section id="lageplan" title="Lageplan Pad A">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-3">
              <Toggle
                label="Ausschnitt"
                options={[
                  ["lod_14.jpg", "14 km"],
                  ["lod_4_5.jpg", "4,5 km"],
                  ["lod_1_5.jpg", "1,5 km"],
                ]}
                value={lod}
                onChange={setLod}
              />
            </div>
            <PadMap geo={geo} osm={osm} sector={sector ?? null} lod={lod} className="aspect-square w-full border border-rule" />
            <p className="mt-2 text-[0.82rem] text-mist">
              Sentinel-2 L2A, Aufnahme {(lodFile?.acquired ?? []).map((d) => `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`).join(", ")}, 10 m
              Auflösung, farblich gedämpft. Linien: OpenStreetMap. Fächer: genehmigter Startsektor, Radius schematisch.
            </p>
          </div>
          <dl className="grid content-start gap-x-6 gap-y-4 text-[0.95rem] sm:grid-cols-[auto_1fr]">
            <dt className="text-mist">Koordinaten Pad A</dt>
            <dd className="metric text-[0.9rem] text-snow">{fmtCoord(geo.pad.lat, geo.pad.lon, 5)}</dd>
            <dt className="text-mist">Genauigkeit</dt>
            <dd>
              etwa ±{geo.pad.accuracy_m} m; {geo.pad.basis}. Keine amtliche Koordinate veröffentlicht.
            </dd>
            <dt className="text-mist">Startsektor</dt>
            <dd>
              {sector
                ? `${sector.min}–${sector.max}° (Betriebsgenehmigung 22.08.2024, Quelle ${andoya.sector_deg?.source?.replace(/^https?:\/\//, "") ?? "–"}). Die Broschüre von Andøya Space nennt 300° bis 005°; die Genehmigung gilt.`
                : "nicht geliefert"}
            </dd>
            <dt className="text-mist">Inklinationsfenster</dt>
            <dd>
              {incMin != null && incMax != null ? `${incMin}–${incMax}° Basis` : "Fenster unbelegt"}
              {alt ? `, ${alt.inc_min}–${alt.inc_max}° Alternativfenster` : ""}
              {andoya.inc_window_source?.value ? ` (${String(andoya.inc_window_source.value)})` : ""}
            </dd>
            <dt className="text-mist">Abgleich Fachdaten</dt>
            <dd>
              {gap != null ? (
                <>
                  <span className="text-amber">config/sites.yaml</span> führt {fmtCoord(plannedLat!, plannedLon!, 1)} als Planwert; das echte Pad liegt{" "}
                  {fmtNum(gap, 1)} km entfernt. Für die Rechnung ist das ohne Wirkung, die Anzeige nutzt die geprüfte Pad-Koordinate. Integrationswunsch IR-04.
                </>
              ) : (
                "Keine Standortkoordinate in config/sites.yaml geliefert."
              )}
            </dd>
          </dl>
        </div>
      </Section>

      <Section
        id="fenster"
        title="Inklination der E0-Nutzlasten"
        intro={`Basisjahr 2025, alle Nutzlasten (${fmtNum(dist.inc_deg.e0_rows_with_inc)} von ${fmtNum(dist.inc_deg.e0_rows)} mit bekannter Inklination). Das Fenster bestimmt den größten Teil des Ausschlusses vor E1.`}
      >
        <Distribution
          edges={dist.inc_deg.edges}
          counts={dist.inc_deg.e0_count}
          xName="Inklination [°]"
          label="Histogramm der Inklination aller 2025 gestarteten Nutzlasten mit aktivem Fenster 90 bis 108 Grad."
          bands={[
            ...(alt ? [{ from: alt.inc_min, to: alt.inc_max, name: "" }] : []),
            ...(incMin != null && incMax != null ? [{ from: incMin, to: incMax, name: "aktives Fenster", strong: true }] : []),
          ]}
        />
        {e1 && (
          <p className="mt-3 text-[0.92rem] text-mist">
            Technisch erreichbar (E1, zusätzlich Masse und Höhe): <span className="num text-snow">{fmtPct(e1.share_count, 2)}</span> der Nutzlasten,{" "}
            <span className="num text-snow">{fmtPct(e1.share_mass, 2)}</span> der Masse.{alt ? ` Gepunktet: Alternativfenster ${alt.inc_min}–${alt.inc_max}°.` : ""}
          </p>
        )}
      </Section>

      <Section id="masse" title="Masse der E0-Nutzlasten" intro="Logarithmische Klassen. Die Linie markiert die nutzbare Spectrum-Nutzlast für SSO aus vehicles.yaml.">
        <Distribution
          edges={dist.mass_kg.edges}
          counts={dist.mass_kg.e0_count}
          xName="Masse [kg] (log)"
          log
          label="Histogramm der Nutzlastmasse 2025 mit Spectrum-SSO-Schwelle und Smallsat-Grenze."
          lines={[
            ...(ssoKg ? [{ at: ssoKg, name: `Spectrum SSO ${fmtNum(ssoKg)} kg` }] : []),
            { at: 1200, name: "Smallsat 1.200 kg", dashed: true },
          ]}
        />
      </Section>

      <Section id="vergleich" title="Standorte im Vergleich" intro="Felder aus config/sites.yaml, unverändert. Ohne belegtes Fenster rechnet der Rechenkern einen Standort nicht.">
        <div className="overflow-x-auto">
          <table className="stack-sm num w-full border-collapse text-left text-[0.92rem] md:min-w-[720px]">
            <thead className="text-mist">
              <tr className="border-b border-rule">
                <th className="py-2 pr-4 font-normal">Feld</th>
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
        <div className="mt-6">
          <OpenItem title="Standortvergleich mit deduplizierter Union und gemeinsamen Kapazitätsgrenzen">
            Erwartete Lieferung des Fachlaufs (Prompt 11, Aufgabe 7). Die Ansicht zeigt dann je Standort E1 bis E3 und die gemeinsame Obergrenze; bis
            dahin nur die Stammdaten oben.
          </OpenItem>
        </div>
      </Section>
    </>
  );
}
