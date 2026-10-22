"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RailItem {
  id: string;
  nav: string;
}

const NEXT = new Set(["ArrowDown", "ArrowRight", "PageDown", " "]);
const PREV = new Set(["ArrowUp", "ArrowLeft", "PageUp"]);

/**
 * Kapitel-Leiste rechts und Präsentationsmodus über denselben Kapiteln.
 * P schaltet um; im Präsentationsmodus springen Pfeiltasten, Leertaste und Bild-Tasten kapitelweise, F für Vollbild.
 */
export function ChapterRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(0);
  const [present, setPresent] = useState(false);
  // Ziel des letzten Sprungs: schnelles Tippen soll weiterzählen, auch bevor das Scrollen das Kapitel erreicht.
  const cur = useRef(0);
  const ids = items.map((i) => i.id).join("|");

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = items.findIndex((it) => it.id === e.target.id);
          if (i >= 0) {
            setActive(i);
            cur.current = i;
          }
        }),
      { rootMargin: "-45% 0px -54% 0px" },
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const go = useCallback(
    (i: number) => {
      const k = Math.max(0, Math.min(items.length - 1, i));
      cur.current = k;
      setActive(k);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(items[k].id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("praesentation", present);
    return () => document.documentElement.classList.remove("praesentation");
  }, [present]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, select, textarea, [contenteditable]")) return;
      if (e.key === "p" || e.key === "P") {
        setPresent((p) => !p);
        return;
      }
      if (!present) return;
      // Leertaste auf Schaltflächen und Links bleibt deren Aktion.
      if (e.key === " " && el?.closest("button, a, summary")) return;
      if (NEXT.has(e.key)) go(cur.current + 1);
      else if (PREV.has(e.key)) go(cur.current - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(items.length - 1);
      else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
        return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, go, items.length]);

  return (
    <>
      <nav aria-label="Kapitel" className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:right-6">
        <ol className="flex flex-col items-end">
          {items.map((it, i) => {
            const on = i === active;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(i);
                  }}
                  aria-current={on ? "step" : undefined}
                  className="group flex items-center justify-end gap-3 py-[0.45rem] pl-4 no-underline"
                >
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[0.8rem] backdrop-blur-sm transition-[opacity,color,transform] duration-500 ease-[var(--ease-out-expo)] ${
                      on
                        ? "bg-night/70 text-snow opacity-100"
                        : "translate-x-1 bg-night/70 text-mist opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                    }`}
                  >
                    {it.nav}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`block h-[2px] rounded-full transition-[width,background-color] duration-500 ease-[var(--ease-out-expo)] ${
                      on ? "w-9 bg-ice" : "w-4 bg-rule-strong group-hover:w-6 group-hover:bg-mist"
                    }`}
                  />
                </a>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => setPresent((p) => !p)}
          aria-pressed={present}
          className="mt-5 ml-auto flex items-center gap-2 border border-rule-strong bg-night/70 px-2.5 py-1.5 text-[0.78rem] text-snow backdrop-blur-sm hover:border-ice"
        >
          {present ? "Präsentation beenden" : "Präsentieren"}
          <kbd className="metric rounded-sm border border-rule px-1 text-mist">P</kbd>
        </button>
      </nav>
      {present && (
        <p className="pointer-events-none fixed bottom-4 left-4 z-30 text-[0.78rem] text-mist sm:left-8" aria-live="polite">
          {/* Zählung wie in den Kapitelköpfen: Einstieg ist 00, danach 01 bis n. */}
          <span className="metric text-snow">
            {String(active).padStart(2, "0")} / {String(items.length - 1).padStart(2, "0")}
          </span>{" "}
          · {items[active]?.nav} · Pfeiltasten blättern, F Vollbild, P beendet
        </p>
      )}
    </>
  );
}
