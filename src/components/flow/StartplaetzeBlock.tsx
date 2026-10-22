"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SitesCompare } from "@/lib/story";
import type { PinPos, View } from "./Globe";
import { nf, num } from "./shared";
import { fill, OVERVIEW, siteScore, siteVars } from "./DeepDiveFacts";

const Globe = dynamic(() => import("./Globe").then((m) => m.Globe), { ssr: false });

// Deep Dive im Kapitel fährt bis kurz über den Pad; die Vollansicht je Platz liegt unter /deepdive/<id>/.
const DIVE_DIST = 1.14;
const FLIGHT_MS = 1500;

/** flow.json["startplaetze"]. In karte, win und flights stehen {permitted}, {pad}, {inc} für Kernzahlen aus sites_compare.json. */
export interface StartplaetzeData {
  hinweis: string;
  fuss: string;
  offen: string;
  links: string[];
  rechts: string[];
  plaetze: Record<string, Platz>;
  status: Record<string, string>;
  explorer: {
    titel: string;
    kriterien: string[];
    gewichte: Record<string, [string, number[]]>;
    /** Noch nicht bewertete Plätze aus der Case-DB: Name, Land, Status, Notiz. */
    offen: [string, string, string, string][];
    offen_label: string;
    /** Alle Startorte der Welt (Launch Library 2, je Ort summiert): Name, Land, Orbitalstarts; nur bei einer Suche sichtbar. */
    welt: [string, string | null, number][];
    /** Zeilentext Einzahl/Mehrzahl mit {starts}. */
    welt_zeile: [string, string];
    welt_quelle: string;
    fuss: string;
  };
}

export interface Platz {
  name: string;
  tag: string;
  karte: string[];
  win: string;
  flights: string;
  orbits: [string, string][];
  logi: string;
}

/** Frage 2 (Artboard 3): sechs Startplätze als Karten und auf dem Globus, Klick fährt zum Pad (Deep Dive), darunter der Explorer. */
export function StartplaetzeBlock({ d, sc }: { d: StartplaetzeData; sc: SitesCompare }) {
  const [sel, setSel] = useState("andoya");
  const [phase, setPhase] = useState<"overview" | "flying" | "dive">("overview");
  const [view, setView] = useState<View>(OVERVIEW);
  const [pins, setPins] = useState<Record<string, PinPos>>({});
  const [q, setQ] = useState("");
  const [w, setW] = useState("gleich");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const sites = useMemo(() => sc.sites.filter((s) => d.plaetze[s.id]), [sc, d]);
  const site = (id: string) => sites.find((s) => s.id === id);
  const pinList = useMemo(() => sites.map((s) => ({ id: s.id, lat: num(s.lat), lon: num(s.lon) })), [sites]);

  const go = (id: string) => {
    const s = site(id);
    if (!s) return;
    window.clearTimeout(timer.current);
    setSel(id);
    setPhase("flying");
    setView({ lat: num(s.lat), lon: num(s.lon), dist: DIVE_DIST });
    timer.current = window.setTimeout(() => setPhase("dive"), FLIGHT_MS);
  };
  const back = () => {
    window.clearTimeout(timer.current);
    setPhase("overview");
    setView({ ...OVERVIEW });
  };
  const p = d.plaetze[sel];
  const away = phase !== "overview";
  const vars = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, siteVars(sc, s.id, d.offen).vars])), [sites, sc, d]);

  const card = (id: string) => {
    const c = d.plaetze[id];
    const s = site(id);
    if (!c || !s) return null;
    return (
      <button
        key={id}
        type="button"
        onClick={() => go(id)}
        className="flex w-full flex-col gap-2 rounded-[16px_6px_18px_8px] border-2 bg-night-2 px-4 py-3.5 text-left hover:bg-night-3"
        style={{ borderColor: id === sel && away ? "var(--color-red)" : "var(--color-rule-strong)" }}
      >
        <span className="font-mono text-[12px] tracking-[0.12em] text-mist-2">{c.tag}</span>
        <span className="text-[21px] font-semibold">{c.name}</span>
        <span className="grid grid-cols-[82px_minmax(0,1fr)] gap-x-2.5 gap-y-1 text-[14px] leading-[1.35]">
          {["Flights/year", "Payload", "Industries"].map((l, i) => (
            <span key={l} className="contents">
              <span className="text-mist">{l}</span>
              <span>{fill(c.karte[i], vars[id])}</span>
            </span>
          ))}
        </span>
      </button>
    );
  };

  // Explorer: sechs Kriterien je Platz aus sites_compare.json (factors), Gesamt = gewichteter Mittelwert.
  const weights = d.explorer.gewichte[w][1];
  const needle = q.trim().toLowerCase();
  const rows = sites
    .map((s) => ({ id: s.id, name: d.plaetze[s.id].name, cc: s.country, status: d.status[s.isar_status ?? ""] ?? s.isar_status ?? "", ...siteScore(sc, s.id, weights) }))
    .filter((r) => !needle || `${r.name} ${r.cc} ${r.status}`.toLowerCase().includes(needle))
    .sort((a, b) => b.total - a.total);
  // Ohne Suche die drei offenen DB-Plätze; mit Suche zusätzlich passende Weltorte (LL2), bewertete Plätze bleiben oben.
  const welt = needle
    ? d.explorer.welt.map(([n, cc, starts]): [string, string, string, string] => [n, cc ?? "–", "–", fill(d.explorer.welt_zeile[starts === 1 ? 0 : 1], { starts: nf(starts) })])
    : [];
  const open = [...d.explorer.offen, ...welt].filter((r) => !needle || r.slice(0, 3).join(" ").toLowerCase().includes(needle));
  const COLS = "grid-cols-[minmax(0,1.6fr)_44px_96px_repeat(6,minmax(0,1fr))_64px]";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,280px)]">
        <div className="flex flex-col gap-3.5">{d.links.map(card)}</div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="relative aspect-square w-full max-w-[640px] overflow-hidden rounded-md">
            <Globe view={view} from={OVERVIEW} pins={pinList} onPins={setPins} />
            <div className="pointer-events-none absolute inset-0">
              {!away &&
                sites.map((s, i) => {
                  const pp = pins[s.id];
                  if (!pp?.front) return null;
                  const left = s.id === "andoya";
                  return (
                    <div key={s.id}>
                      <button type="button" className="pad pointer-events-auto" onClick={() => go(s.id)} aria-label={`Deep dive ${d.plaetze[s.id].name}`} style={{ left: pp.x, top: pp.y }}>
                        <span className="pulse" style={{ animationDelay: `${(i * 0.4).toFixed(1)}s` }} />
                        <span className="dot" />
                      </button>
                      <span className="plabel" style={{ left: pp.x, top: pp.y, transform: left ? "translate(calc(-100% - 20px), -50%)" : "translate(20px, -50%)" }}>
                        {d.plaetze[s.id].name}
                      </span>
                    </div>
                  );
                })}
              {phase === "dive" && pins[sel] && (
                <>
                  <span className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/85 bg-red" style={{ left: pins[sel].x, top: pins[sel].y }} />
                  <span className="absolute -translate-y-1/2 bg-night/80 px-2 py-0.5 text-[15px] font-semibold" style={{ left: pins[sel].x + 16, top: pins[sel].y }}>
                    {p.name} · Pad
                  </span>
                </>
              )}
            </div>
            {phase === "dive" && (
              <div className="panel-in absolute inset-x-3.5 bottom-3.5 flex flex-col gap-2.5 border border-rule-strong bg-night/90 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[19px] font-semibold">{p.name} · Deep Dive</span>
                  <Link href={`/deepdive/${sel}/`} className="inline-flex min-h-11 items-center text-[15px] text-ice">
                    Full view ↗
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-x-[18px] gap-y-2 text-[14px] leading-[1.4]">
                  {[
                    ["Inclination window", fill(p.win, vars[sel])],
                    ["Flights per year", fill(p.flights, vars[sel])],
                    ["Logistics from Vaterstetten", p.logi],
                  ].map(([l, v]) => (
                    <div key={l} className="flex flex-col gap-0.5">
                      <span className="text-mist">{l}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] text-mist">Orbits:</span>
                  {p.orbits.map(([n, kg]) => (
                    <span key={n} className="border border-rule-strong px-2 py-0.5 text-[14px]">
                      {n} <b className="font-mono font-medium text-ice">{kg}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!away && <span className="text-[15px] text-mist">{d.hinweis}</span>}
        </div>

        <div className="flex flex-col gap-3.5">{d.rechts.map(card)}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <span className="text-[15px] text-mist">{d.fuss}</span>
        <button
          type="button"
          onClick={back}
          disabled={!away}
          className="min-h-11 bg-[linear-gradient(transparent_55%,rgba(255,90,79,0.55)_55%,rgba(255,90,79,0.55)_88%,transparent_88%)] px-2.5 text-[18px] font-semibold disabled:opacity-40"
        >
          [ back to overview ]
        </button>
      </div>

      <details className="group border-t border-rule pt-[22px]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3.5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-snow font-bold transition-transform group-open:rotate-45">
            +
          </span>
          <h3 className="text-[26px] font-semibold">{d.explorer.titel}</h3>
        </summary>
        <div className="mt-3.5 flex flex-wrap items-center gap-3.5">
          <label className="flex items-center gap-2 text-[15px] text-mist">
            Search
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, country, status"
              className="min-h-11 w-[200px] border border-rule-strong bg-night-2 px-2.5 text-[15px] text-snow"
            />
          </label>
          <div role="group" aria-label="Weighting" className="flex gap-1">
            {Object.entries(d.explorer.gewichte).map(([k2, [label]]) => (
              <button
                key={k2}
                type="button"
                onClick={() => setW(k2)}
                aria-pressed={k2 === w}
                className={`min-h-11 border px-3 text-[14px] ${k2 === w ? "border-ice bg-ice text-night" : "border-rule-strong bg-night-2 text-snow"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3.5 overflow-x-auto">
          <div className="min-w-[860px]">
            <div className={`grid ${COLS} gap-2.5 border-b border-rule-strong px-3 pb-1.5 text-[13px] text-mist`}>
              <span>Launch site</span>
              <span>Country</span>
              <span>Status</span>
              {d.explorer.kriterien.map((k) => (
                <span key={k}>{k}</span>
              ))}
              <span>Total</span>
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {rows.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => go(r.id)}
                  className={`grid ${COLS} min-h-11 w-full items-center gap-2.5 border bg-night-2 px-3 py-1 text-left text-[15px]`}
                  style={{ borderColor: r.id === sel && away ? "var(--color-red)" : "var(--color-rule)" }}
                >
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-mist">{r.cc}</span>
                  <span className="text-mist">{r.status}</span>
                  {r.scores.map((v, j) => (
                    <span key={j} className="flex items-center gap-1.5">
                      <span className="h-1.5 flex-1 bg-night-3">
                        <span className="block h-full" style={{ width: `${(v / 5) * 100}%`, background: v >= 4.5 ? "#7ee0b5" : v >= 3.5 ? "#8fd3ff" : "#8794a8" }} />
                      </span>
                      <span className="w-[26px] font-mono text-[13px]">{nf(v, 1)}</span>
                    </span>
                  ))}
                  <b className={`font-mono text-[17px] font-semibold ${i === 0 ? "text-aurora" : "text-snow"}`}>{nf(r.total, 2)}</b>
                </button>
              ))}
              {open.map(([name, cc, status, note]) => (
                <div key={name} className="grid min-h-11 grid-cols-[minmax(0,1.6fr)_44px_96px_minmax(0,6fr)_64px] items-center gap-2.5 border border-dashed border-rule px-3 py-1 text-[15px] text-mist">
                  <span className="font-semibold text-snow">{name}</span>
                  <span>{cc}</span>
                  <span>{status}</span>
                  <span>
                    {d.explorer.offen_label} · {note}
                  </span>
                  <span>–</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3.5 text-[13px] leading-normal text-mist-2">
          {d.explorer.fuss} {d.explorer.welt_quelle}
        </p>
      </details>
    </div>
  );
}
