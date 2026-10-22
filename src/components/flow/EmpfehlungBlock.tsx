"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { SitesCompare, Tables } from "@/lib/story";
import type { PinPos } from "./Globe";
import { nf, num, Rocket, TON, val, type FlowData, type Ton } from "./shared";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

export interface EmpfehlungData {
  kicker: string;
  urteil_label: string;
  urteil: string;
  pruef_titel: string;
  pruef: string[];
  plaetze: [string, string, Ton][];
  legende: Record<Ton, string>;
  karten: { tag: string; wert?: string; einheit: string; satz: string; ton: Ton }[];
}

/** Empfehlung (Artboard 5): Schlussbild spiegelt den Einstieg, derselbe Globus nur mit den empfohlenen Rampen. */
export function EmpfehlungBlock({ d, t, sc, home }: { d: EmpfehlungData; t: Tables; sc: SitesCompare; home: FlowData["weltmarkt"]["home"] }) {
  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const view = useMemo(() => ({ ...home, lat: home.lat - 6, lon: home.lon - 14 }), [home]);
  const pinList = useMemo(
    () =>
      d.plaetze.flatMap(([id]) => {
        const s = sc.sites.find((x) => x.id === id);
        return s ? [{ id, lat: num(s.lat), lon: num(s.lon) }] : [];
      }),
    [d, sc],
  );

  const rampe = val(t, "portfolio_chain:A_rampe_wetter:value");
  const plus = val(t, "sites_meta:all:union_e2_count") / val(t, "sites:andoya:e2_count") - 1;
  const werte = [`${nf(rampe)} → ${nf(2 * rampe)}`, undefined, `+${nf(plus * 100)}%`];
  const size: Record<Ton, number> = { zuerst: 18, versicherung: 16, option: 14, nicht: 10 };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-center gap-9 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)]">
        <div className="flex flex-col gap-1 border-2 border-aurora px-4 py-3.5">
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-aurora">{d.urteil_label}</span>
          <span className="text-[26px] font-semibold">{d.urteil}</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative aspect-square w-full max-w-[560px]">
            <Globe view={view} from={{ ...view, lon: view.lon - 60 }} pins={pinList} onPins={setPins} />
            <div className="pointer-events-none absolute inset-0">
              {d.plaetze.map(([id, label, ton]) => {
                const p = pins[id];
                if (!p?.front) return null;
                const r = size[ton];
                const strong = ton === "zuerst" || ton === "versicherung";
                const left = id === "andoya" || id === "saxavord_isar";
                return (
                  <div key={id}>
                    {id === "andoya" && <Rocket x={p.x} y={p.y} rot={p.rot} delay="0s" nose={TON.zuerst} />}
                    {id === "andoya" && <Rocket x={p.x} y={p.y} rot={p.rot + 12} delay="2s" nose={TON.zuerst} />}
                    {id === "nova_scotia" && <Rocket x={p.x} y={p.y} rot={p.rot} delay="1s" nose={TON.versicherung} />}
                    <span
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${strong ? "border-2 border-white" : ""}`}
                      style={{ left: p.x, top: p.y, width: r, height: r, background: TON[ton] }}
                    />
                    <span
                      className={`absolute whitespace-nowrap px-2 py-0.5 ${strong ? "bg-night/85 text-[15px] font-semibold" : ton === "nicht" ? "bg-night/70 text-[13px] text-mist" : "bg-night/85 text-[14px]"}`}
                      style={{
                        left: p.x,
                        top: p.y,
                        // Andøya-Label links oberhalb des Punkts (Mockup-Stand 22.10.2026).
                        transform: id === "andoya" ? "translate(calc(-100% - 10px), calc(-100% - 12px))" : left ? `translate(calc(-100% - ${r}px), -50%)` : `translate(${r}px, -50%)`,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-x-[18px] gap-y-1.5 text-[14px] text-mist">
            {(Object.keys(d.legende) as Ton[]).map((k) => (
              <span key={k}>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: TON[k] }} />
                {d.legende[k]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-x-2 border-rule-strong px-5 py-2">
          <h3 className="text-[22px] font-semibold leading-[1.25]">{d.pruef_titel}</h3>
          <ol className="flex flex-col text-[15px] leading-[1.4]">
            {d.pruef.map((p, i) => (
              <li key={p} className="flex gap-3 border-b border-rule py-[9px]">
                <span className={`flex-none font-mono ${i === 0 ? "text-aurora" : "text-mist-2"}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={i === 0 ? "font-semibold" : ""}>{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {d.karten.map((c, i) => (
          <div key={c.tag} className="flex flex-col gap-2.5 border-2 bg-night-2 px-[22px] py-5" style={{ borderColor: TON[c.ton] }}>
            <span className="font-mono text-[13px]" style={{ color: c.ton === "zuerst" ? "#ff8a80" : TON[c.ton] }}>
              {c.tag}
            </span>
            <span className="text-[40px] font-semibold leading-none">
              {c.wert ?? werte[i]} <span className="text-[16px] font-normal text-mist">{c.einheit}</span>
            </span>
            <span className="text-[16px] leading-[1.45] text-mist">{c.satz}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
