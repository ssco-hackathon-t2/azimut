"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { carryQuery } from "@/lib/selection";
import type { Provenance } from "@/lib/contract";
import { fmtDate } from "@/lib/format";

/** Dauerhafte Kennzeichnung des Datenstands. Bei Fixtures nicht ausblendbar. */
export function ProvenanceNote({ p, compact = false }: { p: Provenance; compact?: boolean }) {
  const fixture = p.status === "fixture";
  const q = carryQuery(useSearchParams());
  return (
    <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.86rem] ${fixture ? "text-amber" : "text-aurora"}`}>
      <span className="inline-flex items-baseline gap-2 font-medium">
        <span aria-hidden="true" className={`inline-block size-1.5 translate-y-[-0.1em] rounded-full ${fixture ? "bg-amber" : "bg-aurora"}`} />
        {p.label}
      </span>
      {!compact && (
        <span className="text-mist">
          Engine version <span className="metric text-snow">{p.source_commit.slice(0, 7)}</span> · GCAT catalogue{" "}
          {fmtDate(p.catalog_date)} · Snapshot <span className="metric text-snow">{p.snapshot_id ?? "–"}</span> ·{" "}
          <Link href={`/belege/${q}#datenstand`} className="text-mist hover:text-snow">
            Provenance
          </Link>
        </span>
      )}
    </div>
  );
}
