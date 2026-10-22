"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { carryQuery } from "@/lib/selection";
import { useJSON } from "@/lib/data";
import type { Manifest, StatsFile } from "@/lib/contract";
import { fmtDate, fmtNum } from "@/lib/format";

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
          <p className="text-snow">Andøya Addressability Tool · Stern Stewart AI-Hackathon, Case Isar Aerospace</p>
          <p className="measure">
            Eigenständige Weboberfläche. Die Andøya-Analyse stammt aus dem Python-Rechenkern des Projekts, die Kostenkurve unter
            „Kosten“ aus der Isar Case DB. Die Oberfläche rechnet nicht, sie stellt nur dar.
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Datenstand</dt>
          <dd className="text-snow">{p ? p.label : "lädt …"}</dd>
          <dt>Engine-Commit</dt>
          <dd className="metric text-snow">{p ? p.source_commit.slice(0, 7) : "–"}</dd>
          <dt>GCAT-Katalog</dt>
          <dd className="text-snow">{p ? fmtDate(p.catalog_date) : "–"}</dd>
          {t && (
            <>
              <dt>Prüfstand (archiviert)</dt>
              <dd>
                <Link href={`/belege/${q}#pruefstand`} className={t.failed > 0 ? "text-alert" : "text-snow"}>
                  {fmtNum(t.passed)} von {fmtNum(t.total)} Tests bestanden
                  {t.failed > 0 ? `, ${fmtNum(t.failed)} fehlgeschlagen` : ""}
                </Link>
              </dd>
            </>
          )}
          <dt>Karten</dt>
          <dd>
            <Link href={`/belege/${q}#karten`} className="text-snow">
              Quellen und Lizenzen
            </Link>
          </dd>
        </dl>
      </div>
    </footer>
  );
}
