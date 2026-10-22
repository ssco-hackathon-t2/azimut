"use client";

import { useEffect, useState } from "react";

// Next.js setzt basePath nur für Routen und next/link, nicht für fetch, Texturen oder Downloads.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Pfad unter public/ mit Unterpfad versehen. */
export function asset(path: string): string {
  return `${BASE_PATH}/${path.replace(/^\//, "")}`;
}

// Fixture-Satz; eine echte Lieferung des Fachlaufs ersetzt nur dieses Verzeichnis (HANDOFF.md).
export const DATA_DIR = "data/fixture";

const cache = new Map<string, Promise<unknown>>();

export function loadJSON<T>(name: string): Promise<T> {
  return loadURL<T>(asset(`${DATA_DIR}/${name}`));
}

/** Beliebige Datei unter public/ laden (z. B. data/sites/sites_compare.json), mit demselben Cache. */
export function loadAsset<T>(path: string): Promise<T> {
  return loadURL<T>(asset(path));
}

function loadURL<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url.split("/").pop()}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    // Fehlgeschlagene Ladeversuche nicht cachen, sonst hilft kein erneuter Versuch.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export type Loadable<T> =
  | { state: "loading" }
  | { state: "error"; error: string; retry: () => void }
  | { state: "ready"; data: T };

/** Lädt eine Ergebnisdatei aus DATA_DIR; spätere Antworten nach Unmount werden verworfen. */
export function useJSON<T>(name: string): Loadable<T> {
  return useURL<T>(asset(`${DATA_DIR}/${name}`));
}

/** Lädt eine beliebige Datei unter public/ (z. B. geo/manifest.json). */
export function useAssetJSON<T>(path: string): Loadable<T> {
  return useURL<T>(asset(path));
}

function useURL<T>(url: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Loadable<T>>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    setResult({ state: "loading" });
    loadURL<T>(url).then(
      (data) => alive && setResult({ state: "ready", data }),
      (e: unknown) =>
        alive &&
        setResult({
          state: "error",
          error: e instanceof Error ? e.message : String(e),
          retry: () => setAttempt((a) => a + 1),
        }),
    );
    return () => {
      alive = false;
    };
  }, [url, attempt]);
  return result;
}
