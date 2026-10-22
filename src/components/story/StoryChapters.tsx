"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { ConfigFile, Manifest, Run, RunsFile, ScenarioId } from "@/lib/contract";
import {
  defaultFmt,
  fmtValue,
  lookup,
  resolve,
  splitTokens,
  statusLabel,
  useSeen,
  type Block,
  type Chapter,
  type Kpi,
  type SitesCompare,
  type Tables,
} from "@/lib/story";
import { fmtNum, fmtPct } from "@/lib/format";
import { KeyStatement } from "@/components/analysis/KeyStatement";
import { FunnelWaterfall } from "@/components/charts/FunnelWaterfall";
import { ScenarioCompare } from "@/components/charts/ScenarioCompare";
import { InclinationLadder } from "@/components/charts/InclinationLadder";
import { SpecChart } from "@/components/charts/SpecChart";
import { RunControls } from "@/components/ui/RunControls";
import { ProvenanceNote } from "@/components/ui/ProvenanceNote";
import { OpenItem } from "@/components/ui/States";
import { Toggle } from "@/components/ui/Toggle";

export interface StoryCtx {
  t: Tables;
  sites?: SitesCompare;
  runs?: RunsFile;
  base?: Run;
  current?: Run;
  manifest?: Manifest;
  config?: ConfigFile;
  labels: Record<ScenarioId, string>;
  query: string;
}

const RUN_BLOCKS = new Set(["funnel", "keystatement", "scenarios"]);

export function StoryChapters({ chapters, ctx }: { chapters: Chapter[]; ctx: StoryCtx }) {
  return (
    <>
      {chapters.map((c, i) => (
        <ChapterView key={c.id} c={c} n={i + 1} total={chapters.length} ctx={ctx} />
      ))}
    </>
  );
}

const delay = (d: number) => ({ "--d": d }) as CSSProperties;

function ChapterView({ c, n, total, ctx }: { c: Chapter; n: number; total: number; ctx: StoryCtx }) {
  const [ref, seen] = useSeen<HTMLElement>();
  const usesRuns = c.blocks?.some((b) => RUN_BLOCKS.has(b.kind));
  return (
    <section ref={ref} id={c.id} aria-labelledby={`${c.id}-h`} data-seen={seen ? "" : undefined} className="chapter">
      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-8 md:pr-48">
        <div className="rv" style={delay(0)}>
          <p className="flex items-baseline gap-3 text-[0.82rem] uppercase tracking-[0.14em] text-ice">
            <span className="metric text-mist">
              {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            {c.kicker}
          </p>
          <h2 id={`${c.id}-h`} className="mt-4 max-w-[24ch] text-[clamp(1.9rem,4.2vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-snow">
            <Tokens text={c.title} t={ctx.t} />
          </h2>
          {c.lead && (
            <p className="mt-5 max-w-[62ch] text-[clamp(1.02rem,1.4vw,1.22rem)] leading-relaxed text-mist">
              <Tokens text={c.lead} t={ctx.t} strong />
            </p>
          )}
        </div>
        {c.kpis && c.kpis.length > 0 && (
          <div className="rv mt-12" style={delay(1)}>
            <Kpis items={c.kpis} t={ctx.t} run={seen} />
          </div>
        )}
        {c.blocks?.map((b, k) => (
          <div key={k} className="rv mt-14" style={delay(k + 2)}>
            <BlockView b={b} ctx={ctx} />
          </div>
        ))}
        {usesRuns && ctx.runs && (
          <div className="mt-8">
            <ProvenanceNote p={ctx.runs.provenance} compact />
          </div>
        )}
      </div>
    </section>
  );
}

/** Text mit Zahlen-Verweisen; jede Zahl zeigt beim Überfahren Herkunft und Status. */
export function Tokens({ text, t, strong = false }: { text: string; t: Tables; strong?: boolean }) {
  return (
    <>
      {splitTokens(text, t).map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <span key={i} title={p.title} className={`num ${p.missing ? "text-alert" : strong ? "font-semibold text-snow" : ""}`}>
            {p.text}
          </span>
        ),
      )}
    </>
  );
}

function Kpis({ items, t, run }: { items: Kpi[]; t: Tables; run: boolean }) {
  return (
    <dl className="grid gap-x-12 gap-y-10 md:grid-cols-[1.5fr_1fr_1fr]">
      {items.map((k, i) => {
        const v = resolve(t, k.ref, k.of);
        const tone = k.tone === "win" ? "text-aurora" : k.tone === "accent" ? "text-ice" : "text-snow";
        return (
          <div key={k.ref + i} className="flex flex-col border-t border-rule pt-5">
            <dt className="order-2 mt-3 text-[0.95rem] text-snow">{k.label}</dt>
            <dd
              className={`order-1 num font-display font-semibold leading-[0.92] tracking-[-0.035em] ${tone} ${
                i === 0 ? "text-[clamp(3.6rem,8vw,6.8rem)]" : "text-[clamp(2.2rem,3.6vw,3.2rem)]"
              }`}
            >
              {k.prefix && <span className="mb-[0.12em] block text-[0.3em] font-medium leading-tight tracking-normal text-mist">{k.prefix}</span>}
              {v ? <CountUp v={v.value} fmt={k.format ?? (k.of ? "pct" : defaultFmt(v))} digits={k.digits} run={run} /> : <span className="text-alert">[{k.ref} fehlt]</span>}
              {k.suffix && <span className="ml-[0.08em]">{k.suffix}</span>}
            </dd>
            <dd className="order-3 mt-1.5 text-[0.82rem] text-mist">
              {k.note && (
                <>
                  <Tokens text={k.note} t={t} />{" "}
                </>
              )}
              {v && <span className="text-mist-2">· {statusLabel(v.status)}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Zählt beim ersten Erscheinen hoch; Stellen stehen vom Zielwert aus fest, damit nichts springt. */
function CountUp({ v, fmt, digits, run }: { v: number | string | null; fmt: ReturnType<typeof defaultFmt>; digits?: number; run: boolean }) {
  const target = typeof v === "number" ? v : null;
  const [shown, setShown] = useState<number | null>(target === null ? null : 0);
  useEffect(() => {
    if (target === null || !run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      setShown(k === 1 ? target : target * (1 - Math.pow(2, -10 * k)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  if (target === null) return <>{fmtValue(v, fmt, digits)}</>;
  const final = fmtValue(target, fmt, digits);
  return (
    <>
      <span aria-hidden="true">{fmtValue(shown, fmt, digits, target)}</span>
      <span className="sr-only">{final}</span>
    </>
  );
}

function BlockView({ b, ctx }: { b: Block; ctx: StoryCtx }) {
  switch (b.kind) {
    case "text":
      return (
        <p className="max-w-[68ch] text-[1.08rem] leading-relaxed text-snow">
          <Tokens text={b.text} t={ctx.t} strong />
        </p>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-aurora pl-6 font-display text-[clamp(1.5rem,2.8vw,2.3rem)] font-semibold leading-tight tracking-[-0.02em] text-snow">
          <Tokens text={b.text} t={ctx.t} />
        </blockquote>
      );
    case "placeholder":
      return <OpenItem title="Inhalt folgt">{b.text}</OpenItem>;
    case "panel":
      return <SpecChart id={b.id} initialView={b.initialView} />;
    case "inclination":
      return ctx.sites ? <InclinationLadder data={ctx.sites} /> : <OpenItem title="Standortvergleich">sites_compare.json fehlt.</OpenItem>;
    case "q1":
      return <Q1Levers ctx={ctx} />;
    case "links":
      return <DeepLinks query={ctx.query} />;
    case "funnel":
      return ctx.base ? <FunnelWaterfall run={ctx.base} metric="count" /> : <OpenItem title="Trichter">Headline-Run fehlt im Datensatz.</OpenItem>;
    case "keystatement":
      return ctx.base && ctx.current ? <KeyStatement base={ctx.base} current={ctx.current} scenarioLabels={ctx.labels} /> : null;
    case "scenarios": {
      const cur = ctx.current;
      if (!cur || !ctx.runs || !ctx.manifest) return <OpenItem title="Szenarien">Für diese Auswahl liegt kein vorbereiteter Run vor.</OpenItem>;
      const same = ctx.runs.runs.filter((x) => x.params.year === cur.params.year && x.params.scope === cur.params.scope && x.params.site_id === cur.params.site_id);
      return (
        <div className="grid gap-6">
          <RunControls manifest={ctx.manifest} config={ctx.config} />
          <ScenarioCompare runs={same} active={cur.params.scenario} labels={ctx.labels} />
        </div>
      );
    }
  }
}

/** Frage 1: Startregler und Fensterschalter. Formel der Case-DB (Starts / 329), Werte aus sites_compare.json. */
function Q1Levers({ ctx }: { ctx: StoryCtx }) {
  const q1 = ctx.sites?.q1;
  const a = ctx.sites?.sites.find((s) => s.id === "andoya");
  const lo = lookup(ctx.t, "assumptions:andoya_launches_per_pad:value_low")?.value;
  const mid = lookup(ctx.t, "assumptions:andoya_launches_per_pad:value_base")?.value;
  const hi = lookup(ctx.t, "assumptions:andoya_launches_per_pad:value_high")?.value;
  const ok = typeof lo === "number" && typeof mid === "number" && typeof hi === "number";
  const [n, setN] = useState(ok ? mid : 0);
  const [win, setWin] = useState<"basis" | "alt">("basis");
  if (!q1 || !a || !ok) return <OpenItem title="Regler Frage 1">q1 in sites_compare.json oder assumptions.andoya_launches_per_pad fehlt.</OpenItem>;
  const w = win === "alt" ? q1.window_alt : a;
  const deg = (x: number) => `${fmtNum(x, Number.isInteger(x) ? 0 : 1)}°`;
  return (
    <div className="grid gap-x-16 gap-y-10 border-y border-rule py-8 lg:grid-cols-2">
      <div>
        <label htmlFor="q1-starts" className="flex items-baseline justify-between text-[0.95rem] text-snow">
          Starts pro Jahr von Andøya
          <output htmlFor="q1-starts" className="num text-[1.6rem] font-semibold text-ice">
            {n}
          </output>
        </label>
        <input
          id="q1-starts"
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="mt-3 w-full accent-[var(--color-ice)]"
        />
        <div className="mt-1 flex justify-between text-[0.78rem] text-mist">
          <span>{lo}</span>
          <span>Annahme Basis {mid}</span>
          <span>{hi}</span>
        </div>
        <p className="mt-6 text-[1.15rem] text-snow">
          <span className="num font-semibold text-aurora">{fmtPct(n / q1.global_launches_2025, 1)}</span> aller Orbitalstarts 2025 ·{" "}
          <span className="num font-semibold text-ice">{fmtPct(n / q1.sso_launches_2025, 0)}</span> der SSO-Starts
        </p>
        <p className="mt-2 text-[0.82rem] text-mist">
          Kapazitätssicht der Case-DB: Starts / {q1.global_launches_2025} bzw. / {q1.sso_launches_2025}. Spanne {lo} bis {hi} Starts je Rampe ·{" "}
          {statusLabel(String(lookup(ctx.t, "assumptions:andoya_launches_per_pad:data_status")?.value ?? ""))}
        </p>
      </div>
      <div>
        <Toggle
          label="Neigungsfenster"
          options={[
            ["basis", `${deg(a.inc_min)} bis ${deg(a.inc_max)} (Basis)`],
            ["alt", `${deg(q1.window_alt.inc_min)} bis ${deg(q1.window_alt.inc_max)} (Isar-Angabe)`],
          ]}
          value={win}
          onChange={(v) => setWin(v as "basis" | "alt")}
        />
        <dl className="mt-6 grid grid-cols-3 gap-6">
          {[
            ["technisch erreichbar", fmtPct(w.e1_share_count, 1)],
            ["offen adressierbar", fmtNum(w.e2_count, 0)],
            ["Missionen/Jahr", fmtNum(w.missions_per_year, 1)],
          ].map(([l, v]) => (
            <div key={l}>
              <dt className="text-[0.82rem] text-mist">{l}</dt>
              <dd className="num mt-1 text-[1.6rem] font-semibold text-snow">{v}</dd>
            </div>
          ))}
        </dl>
        {q1.window_alt.e2_count === a.e2_count && (
          <p className="mt-4 text-[0.88rem] text-mist">Das breitere Fenster ändert den offen adressierbaren Markt nicht.</p>
        )}
      </div>
    </div>
  );
}

const DEEP: [string, string, string][] = [
  ["/analyse/", "Analyse", "Szenarien, Zeitachse bis 2035, Verticals, gleicher Run in allen Ansichten"],
  ["/standort/", "Standort", "Lageplan des echten Pads, Inklinationsfenster, Verteilungen, Standortvergleich"],
  ["/historie/", "Historie", "Gestartete Nutzlasten seit 1957 nach Orbit, Staatengruppe und Trägerklasse"],
  ["/belege/", "Belege", "Formel, Eingangszahlen, Annahmen und Quellen hinter jeder Zahl"],
  ["/export/", "Export", "Daten des aktiven Runs als JSON und CSV"],
];

function DeepLinks({ query }: { query: string }): ReactNode {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {DEEP.map(([href, t, d]) => (
        <li key={href}>
          <Link href={`${href}${query}`} className="group grid grid-cols-[1fr_auto] items-baseline gap-4 py-5 no-underline sm:grid-cols-[14rem_1fr_auto]">
            <span className="text-[1.25rem] font-medium text-snow">{t}</span>
            <span className="col-span-2 row-start-2 text-mist sm:col-span-1 sm:row-start-1">{d}</span>
            <span aria-hidden="true" className="text-ice transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
