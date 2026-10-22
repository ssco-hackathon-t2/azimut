"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resultURL } from "./data-source";

// Next.js setzt basePath nur für Routen und next/link, nicht für fetch, Texturen oder Downloads.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Pfad unter public/ mit Unterpfad versehen. */
export function asset(path: string): string {
  return `${BASE_PATH}/${path.replace(/^\//, "")}`;
}

// Fixture-Satz; eine echte Lieferung des Fachlaufs ersetzt nur dieses Verzeichnis (HANDOFF.md).
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "";
export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE ?? (API_ORIGIN ? "live" : BASE_PATH ? "fixture" : "live");
export const DATA_DIR = DATA_MODE === "fixture" ? "data/fixture" : "api";
export function dataURL(name: string, query = ""): string {
  return resultURL(name, query, BASE_PATH, DATA_MODE, API_ORIGIN);
}

const cache = new Map<string, { promise: Promise<unknown>; at: number }>();

export function loadJSON<T>(name: string): Promise<T> {
  return loadURL<T>(dataURL(name));
}

/** Beliebige Datei unter public/ laden (z. B. data/sites/sites_compare.json), mit demselben Cache. */
export function loadAsset<T>(path: string): Promise<T> {
  return loadURL<T>(sourceURL(path));
}

function sourceURL(path: string): string {
  return path.startsWith("data/fixture/") ? dataURL(path.slice("data/fixture/".length)) : asset(path);
}

function loadURL<T>(url: string): Promise<T> {
  const entry = cache.get(url);
  let p = entry && Date.now() - entry.at < 15000 ? entry.promise as Promise<T> : undefined;
  if (!p) {
    p = fetch(url, { cache: "no-store" }).then(async (r) => {
      if (!r.ok) {
        const detail = await r.json().catch(() => null);
        throw new Error(detail?.error ?? `${url.split("/").pop()}: HTTP ${r.status}`);
      }
      return r.json() as Promise<T>;
    });
    // Fehlgeschlagene Ladeversuche nicht cachen, sonst hilft kein erneuter Versuch.
    p.catch(() => cache.delete(url));
    cache.set(url, { promise: p, at: Date.now() });
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
  }
  return p;
}

export type Loadable<T> =
  | { state: "loading" }
  | { state: "error"; error: string; retry: () => void }
  | { state: "ready"; data: T };

/** Lädt eine Ergebnisdatei aus DATA_DIR; spätere Antworten nach Unmount werden verworfen. */
export function useJSON<T>(name: string): Loadable<T> {
  const query = useSearchParams();
  return useURL<T>(dataURL(name, query?.toString()));
}

/** Lädt eine beliebige Datei unter public/ (z. B. geo/manifest.json). */
export function useAssetJSON<T>(path: string): Loadable<T> {
  return useURL<T>(sourceURL(path));
}

function useURL<T>(url: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Loadable<T>>({ state: "loading" });
  const [resultURL, setResultURL] = useState(url);
  useEffect(() => {
    let alive = true;
    setResultURL(url);
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
  return resultURL === url ? result : { state: "loading" };
}
