"use client";

import { useCallback, useEffect, useState } from "react";

export interface RailItem {
  id: string;
  nav: string;
}

/** Kapitel-Leiste rechts: zeigt, wo man steht, und springt per Klick zum Thema (kein Präsentationsmodus). */
export function ChapterRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(0);
  const ids = items.map((i) => i.id).join("|");

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = items.findIndex((it) => it.id === e.target.id);
          if (i >= 0) setActive(i);
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
      setActive(i);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(items[i].id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids],
  );

  return (
    <nav aria-label="Chapters" className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 md:block lg:right-6">
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
    </nav>
  );
}
