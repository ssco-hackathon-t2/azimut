"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buildTables, useLiveJSON, type SitesCompare, type Tables } from "@/lib/story";
import { ErrorState } from "@/components/ui/States";
import { DeepDiveFacts } from "@/components/flow/DeepDiveFacts";
import { GlobeFlight, OrbitFlight } from "@/components/flow/DeepDiveScene";
import { num, type FlowData } from "@/components/flow/shared";

/**
 * Deep Dive je Startplatz (Artboard DeepDive): links die Kamerafahrt, rechts der Steckbrief. Andøya mit der echten
 * OrbitScene-Fahrt (Sentinel-2, OSM, Startsektor); für die anderen fünf fehlen Kacheln, dort fährt der 3D-Globus.
 */
export function DeepDiveView({ site }: { site: string }) {
  const flow = useLiveJSON<FlowData>("data/flow.json");
  const db = useLiveJSON<Tables>("data/isar/isar_data.json");
  const sites = useLiveJSON<SitesCompare>("data/sites/sites_compare.json");
  const sc = sites.state === "ready" ? sites.data : undefined;
  const t = useMemo(() => buildTables(db.state === "ready" ? db.data : {}, sc), [db, sc]);
  const f = flow.state === "ready" ? flow.data : undefined;
  const s = sc?.sites.find((x) => x.id === site);
  const card = f?.startplaetze.plaetze[site];
  const ready = f && card && s && db.state === "ready" && f.deepdive.plaetze[site];
  const loadErr = [flow, db, sites].find((x) => x.state === "error");

  return (
    <section aria-label={card ? `Deep dive ${card.name}` : "Deep dive"} className="mx-auto flex w-full max-w-[88rem] flex-col gap-[18px] px-4 pb-12 pt-4 sm:px-8 lg:pr-24">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex items-center gap-4 text-[15px]">
          <Link href="/#frage-2" className="inline-flex min-h-11 items-center text-mist no-underline hover:text-snow">
            {f?.deepdive.zurueck}
          </Link>
          <span className="text-rule-strong">/</span>
          <span>{card?.name}</span>
        </div>
        {f && (
          <Link
            href="/#frage-2"
            className="inline-flex min-h-11 items-center bg-[linear-gradient(transparent_55%,rgba(255,90,79,0.55)_55%,rgba(255,90,79,0.55)_88%,transparent_88%)] px-2.5 text-[18px] font-semibold text-snow no-underline"
          >
            {f.deepdive.ui.uebersicht}
          </Link>
        )}
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
        <div className="relative isolate aspect-[720/680] w-full overflow-hidden bg-[#070c16]">
          {site === "andoya" ? (
            <OrbitFlight padLabel="Pad A · Isar" />
          ) : (
            s && card && f && <GlobeFlight id={site} name={card.name} lat={num(s.lat)} lon={num(s.lon)} hint={f.deepdive.ui.kacheln} />
          )}
        </div>
        {ready && sc && (
          <DeepDiveFacts
            id={site}
            d={f.deepdive}
            name={card.name}
            tag={card.tag}
            weights={f.startplaetze.explorer.gewichte.resilienz[1]}
            sc={sc}
            t={t}
          />
        )}
      </div>
      {loadErr && loadErr.state === "error" && <ErrorState error={loadErr.error} retry={loadErr.retry} />}
    </section>
  );
}
