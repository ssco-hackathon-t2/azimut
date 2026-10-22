"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { loadAsset, useAssetJSON } from "@/lib/data";
import { CHART, alpha } from "./theme";
import { EChart } from "./EChart";
import { KINDS, viewOptions, type ChartsFile, type Palette, type PanelSpec, type Table } from "./panels/registry";

const STATUS_TEXT: Record<string, string> = {
  belegt: "belegt",
  abgeleitet: "abgeleitet",
  annahme: "Annahme",
  team_annahme: "Team-Annahme",
  unbestaetigt: "unbestätigt",
};

/**
 * Ein Diagramm aus dem Baukasten (public/data/charts.json). Hauptansichten oben rechts als Umschalter,
 * alles Weitere (Backup-Ansichten, Optionen, Tabelle, Quelle) im Eckmenü. Ändern ohne Rebuild: charts.json.
 */
export function SpecChart({ id, initialView }: { id: string; initialView?: string }) {
  const charts = useAssetJSON<ChartsFile>("data/charts.json");
  if (charts.state === "loading") return <PanelShell title="Diagramm wird geladen …" />;
  if (charts.state === "error") return <PanelShell title={`Diagramm-Baukasten nicht ladbar: ${charts.error}`} />;
  const spec = charts.data.panels[id];
  if (!spec) return <PanelShell title={`Panel „${id}“ fehlt in charts.json`} />;
  return <Panel id={id} spec={spec} initialView={initialView} />;
}

function PanelShell({ title }: { title: string }) {
  return (
    <figure className="border border-rule bg-night-2/60 p-6 text-[0.9rem] text-mist" role="status">
      {title}
    </figure>
  );
}

/** Alle Quellen eines Panels laden (Alias -> Daten). */
function useSources(sources: Record<string, string>) {
  const key = JSON.stringify(sources);
  const [state, setState] = useState<{ data?: Record<string, unknown>; error?: string }>({});
  useEffect(() => {
    let alive = true;
    const entries = Object.entries(sources);
    Promise.all(entries.map(([, path]) => loadAsset(path))).then(
      (values) => alive && setState({ data: Object.fromEntries(entries.map(([alias], i) => [alias, values[i]])) }),
      (e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // sources über key verglichen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

function palette(): Palette {
  // Ein Akzent pro Diagramm (Design Guide §1.3). --chart-accent erlaubt der Seite, ihn zu setzen (z. B. Orbit-Rot).
  const accent = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--chart-accent").trim();
  return { accent: accent || CHART.ice, ink: CHART.ink, mist: CHART.mist, muted: alpha(CHART.mist2, 0.6), rule: CHART.rule, font: CHART.font, mono: CHART.mono };
}

function Panel({ id, spec, initialView }: { id: string; spec: PanelSpec; initialView?: string }) {
  const first = spec.views.find((v) => v.id === initialView) ?? spec.views.find((v) => !v.backup) ?? spec.views[0];
  const [viewId, setViewId] = useState(first.id);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});
  const [showTable, setShowTable] = useState(false);
  const [menu, setMenu] = useState(false);
  const src = useSources(spec.sources);
  const menuId = useId();
  const figRef = useRef<HTMLElement>(null);

  const view = spec.views.find((v) => v.id === viewId) ?? first;
  const opts = viewOptions(view, overrides[view.id]);
  const primary = spec.views.filter((v) => !v.backup);
  const backups = spec.views.filter((v) => v.backup);

  const built = useMemo(() => {
    if (!src.data) return null;
    try {
      return KINDS[view.kind](src.data, opts, palette());
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
    // opts ist pro Render neu, Inhalt über JSON vergleichen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src.data, view.kind, JSON.stringify(opts)]);

  // Menü schließen: Escape oder Klick außerhalb der Karte
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const onDown = (e: PointerEvent) => figRef.current && !figRef.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [menu]);

  const setOpt = (key: string, value: string) => setOverrides((o) => ({ ...o, [view.id]: { ...o[view.id], [key]: value } }));
  const reset = () => {
    setViewId(first.id);
    setOverrides({});
    setShowTable(false);
    setMenu(false);
  };
  const modified = viewId !== first.id || Object.keys(overrides).length > 0 || showTable;
  const builtOk = built && !("error" in built) ? built : null;

  return (
    <figure ref={figRef} data-panel={id} className="relative border border-rule bg-night-2/60 backdrop-blur-sm">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule/70 px-5 pt-4 pb-3 sm:px-6">
        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-mist">
            {spec.kicker}
            {view.backup && <span className="border border-ice/60 px-1.5 py-px tracking-[0.12em] text-ice">Backup · {view.label}</span>}
          </p>
          <h3 className="mt-1 text-[1.15rem] leading-snug font-semibold text-snow [text-wrap:balance]">{spec.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {primary.length > 1 && (
            <div role="group" aria-label="Ansicht" className="flex border border-rule-strong">
              {primary.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === view.id}
                  onClick={() => setViewId(v.id)}
                  className={`px-2.5 py-1 text-[0.8rem] transition-colors duration-150 ${v.id === view.id ? "bg-night-3 text-snow shadow-[inset_0_-1px_0_var(--color-ice)]" : "text-mist hover:text-snow"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-label="Diagramm einstellen"
            aria-expanded={menu}
            aria-controls={menuId}
            onClick={() => setMenu((m) => !m)}
            className={`relative grid size-8 place-items-center border transition-colors duration-150 ${menu ? "border-ice text-snow" : "border-rule-strong text-mist hover:text-snow"}`}
          >
            <SlidersIcon />
            {modified && <span aria-hidden="true" className="absolute -top-1 -right-1 size-2 bg-ice" />}
          </button>
        </div>
      </header>

      {menu && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Diagramm einstellen"
          className="absolute top-14 right-3 z-20 w-[min(20rem,calc(100%-1.5rem))] border border-rule-strong bg-night-2 p-4 text-[0.86rem] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          <MenuSection title="Ansicht">
            {spec.views.map((v) => (
              <label key={v.id} className="flex cursor-pointer items-center gap-2 py-1 text-snow">
                <input type="radio" name={`${menuId}-view`} checked={v.id === view.id} onChange={() => setViewId(v.id)} className="accent-[var(--color-ice)]" />
                <span>{v.label}</span>
                {v.backup && <span className="ml-auto font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">Backup</span>}
              </label>
            ))}
          </MenuSection>
          {view.controls?.map((c) => (
            <MenuSection key={c.key} title={c.label}>
              <div className="flex flex-wrap border border-rule-strong">
                {c.values.map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    aria-pressed={opts[c.key] === val}
                    onClick={() => setOpt(c.key, val)}
                    className={`flex-1 px-2 py-1 transition-colors duration-150 ${opts[c.key] === val ? "bg-night-3 text-snow shadow-[inset_0_-1px_0_var(--color-ice)]" : "text-mist hover:text-snow"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </MenuSection>
          ))}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
            {builtOk?.option && builtOk.table && (
              <button type="button" onClick={() => setShowTable((t) => !t)} className="border border-rule-strong px-2.5 py-1 text-snow hover:border-ice">
                {showTable ? "Tabelle ausblenden" : "Werte als Tabelle"}
              </button>
            )}
            <button type="button" onClick={reset} disabled={!modified} className="border border-rule-strong px-2.5 py-1 text-snow hover:border-ice disabled:opacity-40">
              Zurücksetzen
            </button>
          </div>
        </div>
      )}

      <div className="px-3 pt-4 pb-2 sm:px-5">
        {src.error && <p className="p-4 text-alert">Daten nicht ladbar: {src.error}</p>}
        {!src.error && !built && <div className="animate-pulse bg-night-3/40" style={{ height: 260 }} aria-label="Daten werden geladen" />}
        {built && "error" in built && <p className="p-4 text-alert">Baustein {view.kind}: {built.error}</p>}
        {builtOk?.option && <EChart option={builtOk.option} height={builtOk.height ?? 300} label={`${spec.title} (${view.label})`} />}
        {builtOk?.table && (!builtOk.option || showTable) && <DataTable table={builtOk.table} />}
      </div>

      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-4 text-[0.8rem] text-mist sm:px-6">
        {spec.status && (
          <span className="border border-rule-strong px-1.5 py-px font-mono text-[0.66rem] uppercase tracking-[0.12em] text-snow">{STATUS_TEXT[spec.status] ?? spec.status}</span>
        )}
        {view.note && <span>{view.note}</span>}
        {spec.source_note && <span>Quelle: {spec.source_note}</span>}
      </figcaption>
    </figure>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-mist">{title}</legend>
      {children}
    </fieldset>
  );
}

function DataTable({ table }: { table: Table }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-[0.86rem]">
        <thead>
          <tr>
            {table.columns.map(([k, label, align]) => (
              <th key={k} scope="col" className={`border-b border-rule-strong px-2 py-1.5 font-normal text-mist ${align === "right" ? "text-right" : "text-left"}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-b border-rule/60">
              {table.columns.map(([k, , align]) => (
                <td key={k} className={`px-2 py-1.5 text-snow ${align === "right" ? "metric text-right" : ""}`}>
                  {r[k] ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
