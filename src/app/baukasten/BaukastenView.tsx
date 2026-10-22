"use client";

import { useAssetJSON } from "@/lib/data";
import { PageHead } from "@/components/shell/PageHead";
import { SpecChart } from "@/components/charts/SpecChart";
import { validateCharts, type ChartsFile } from "@/components/charts/panels/registry";

/** Alle Panels aus charts.json untereinander: Backup-Galerie für Rückfragen im Pitch. */
export function BaukastenView() {
  const charts = useAssetJSON<ChartsFile>("data/charts.json");
  const errors = charts.state === "ready" ? validateCharts(charts.data) : [];
  return (
    <>
      <PageHead title="Chart kit" />
      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 pb-20 sm:px-8">
        {errors.length > 0 && (
          <ul className="border border-alert p-4 text-[0.9rem] text-alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {charts.state === "ready" && Object.keys(charts.data.panels).map((id) => <SpecChart key={id} id={id} />)}
      </div>
    </>
  );
}
