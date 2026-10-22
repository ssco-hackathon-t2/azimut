"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { Manifest } from "./contract";
import { parseSelection, selectionQuery, type Selection } from "./selection-core";

export * from "./selection-core";

export function useSelection(manifest?: Manifest) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selection = useMemo(() => parseSelection(sp, manifest), [sp, manifest]);
  const update = useCallback(
    (patch: Partial<Selection>) => {
      const next = { ...selection, ...patch };
      // Eigene Parameter (z. B. ?kpi=) beibehalten, Auswahl ersetzen.
      const q = new URLSearchParams(sp?.toString());
      q.delete("szenario");
      q.delete("jahr");
      q.delete("scope");
      new URLSearchParams(selectionQuery(next).slice(1)).forEach((v, k) => q.set(k, v));
      const str = q.toString();
      router.push(`${pathname}${str ? `?${str}` : ""}`, { scroll: false });
    },
    [selection, sp, router, pathname],
  );
  return { selection, update };
}
