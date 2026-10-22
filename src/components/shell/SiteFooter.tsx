"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { carryQuery } from "@/lib/selection";
import { useJSON } from "@/lib/data";
import type { Manifest, StatsFile } from "@/lib/contract";
import { fmtDateEn as fmtDate, fmtNumEn as fmtNum } from "@/lib/story-core";

export function SiteFooter() {
  const m = useJSON<Manifest>("manifest.json");
  const p = m.state === "ready" ? m.data.provenance : null;
  // Fehlt stats.json, entfällt die Zeile still: der Footer fällt nie in einen Fehlerzustand.
  const s = useJSON<StatsFile>("stats.json");
  const t = s.state === "ready" ? s.data.tests : null;
  const q = carryQuery(useSearchParams());
  return (
    <footer className="border-t border-rule/70 bg-night">
      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-10 text-[0.88rem] text-mist sm:px-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-2">
          <p className="text-snow">Azimut · Stern Stewart AI Hackathon, Isar Aerospace case</p>
          <p className="measure">
            Standalone web interface. The Andøya analysis comes from the project's Python engine, the cost curve under
            “Costs” from the Isar Case DB. The interface does not calculate anything, it only displays.
          </p>
          <p>Imagery: NASA Earth Observatory · contains modified Copernicus Sentinel data 2025 · map © OpenStreetMap contributors.</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Data as of</dt>
          <dd className="text-snow">{p ? p.label : "loading …"}</dd>
          <dt>Engine commit</dt>
          <dd className="metric text-snow">{p ? p.source_commit.slice(0, 7) : "–"}</dd>
          <dt>GCAT catalogue</dt>
          <dd className="text-snow">{p ? fmtDate(p.catalog_date) : "–"}</dd>
          {t && (
            <>
              <dt>Test bench (archived)</dt>
              <dd>
                <Link href={`/belege/${q}#pruefstand`} className={t.failed > 0 ? "text-alert" : "text-snow"}>
                  {fmtNum(t.passed)} of {fmtNum(t.total)} tests passed
                  {t.failed > 0 ? `, ${fmtNum(t.failed)} failed` : ""}
                </Link>
              </dd>
            </>
          )}
          <dt>Maps</dt>
          <dd>
            <Link href={`/belege/${q}#karten`} className="text-snow">
              Sources and licences
            </Link>
          </dd>
        </dl>
      </div>
    </footer>
  );
}
