"use client";

import { useEffect, useState } from "react";
import { asset, type Loadable } from "./data";

export * from "./story-core";

/**
 * Lädt eine Datei unter public/ immer frisch (kein Cache), damit eine geänderte story.json beim Neuladen sofort gilt,
 * auch im statischen Export ohne Neubau. Mit ?live alle 2 s erneut: Änderungen erscheinen ohne Neuladen.
 */
export function useLiveJSON<T>(path: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Loadable<T>>({ state: "loading" });
  useEffect(() => {
    let alive = true;
    let last = "";
    let tries = 0;
    let retryTimer: number | undefined;
    const load = () =>
      fetch(asset(path), { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error(`${path.split("/").pop()}: HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => {
          if (!alive || text === last) return;
          const data = JSON.parse(text) as T;
          last = text;
          setResult({ state: "ready", data });
        })
        // Halb gespeicherte Datei (z. B. während eines Updates): letzten guten Stand behalten und kurz danach
        // automatisch neu laden; erst nach mehreren Fehlversuchen den Fehler zeigen.
        .catch((e: unknown) => {
          if (!alive || last) return;
          if (tries++ < 5) {
            retryTimer = window.setTimeout(load, 800);
            return;
          }
          setResult({ state: "error", error: e instanceof Error ? e.message : String(e), retry: () => setAttempt((a) => a + 1) });
        });
    load();
    const live = new URLSearchParams(window.location.search).has("live");
    const id = live ? window.setInterval(load, 2000) : undefined;
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(retryTimer);
    };
  }, [path, attempt]);
  return result;
}

/**
 * Einmal true, sobald der Anfang des Elements das untere Fünftel des Bildschirms passiert hat (Einblenden, Hochzählen).
 * Über die Oberkante statt einen Sichtbarkeitsanteil, damit auch sehr lange Kapitel auslösen.
 */
export function useSeen<E extends Element>() {
  const [el, setEl] = useState<E | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "0px 0px -20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el, seen]);
  return [setEl, seen] as const;
}
