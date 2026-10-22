"use client";

import type { ConfigFile, Manifest, ScenarioId, ScopeId } from "@/lib/contract";
import { SCENARIO_FALLBACK, SCOPE_LABELS } from "@/lib/labels";
import { useSelection } from "@/lib/selection";
import { zoneLabel } from "@/components/charts/TimelineChart";

/** Auswahl der Parameter für den Python-Rechenkern oder den expliziten Offline-Satz. */
export function RunControls({ manifest, config }: { manifest: Manifest; config?: ConfigFile }) {
  const { selection, update } = useSelection(manifest);
  const labels = config?.scenario_labels?.value ?? SCENARIO_FALLBACK;
  return (
    <form
      aria-label="Szenario wählen"
      className="flex min-w-0 max-w-full flex-wrap items-end gap-x-6 gap-y-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-[0.82rem] text-mist">Szenario</legend>
        <div className="flex border border-rule-strong">
          {manifest.scenarios.map((sc: ScenarioId) => {
            const on = selection.scenario === sc;
            return (
              <label
                key={sc}
                className={`cursor-pointer px-3.5 py-2 text-[0.92rem] transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ice ${
                  on ? "bg-ice text-night" : "text-snow hover:bg-night-3"
                }`}
              >
                <input
                  type="radio"
                  name="szenario"
                  value={sc}
                  checked={on}
                  onChange={() => update({ scenario: sc })}
                  className="sr-only"
                />
                {labels[sc] ?? sc}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col text-[0.82rem] text-mist">
        Jahr
        <select
          value={selection.year}
          onChange={(e) => update({ year: Number(e.target.value) })}
          className="mt-1.5 h-[2.6rem] min-w-[7rem] border border-rule-strong bg-night-2 px-3 text-[0.95rem] text-snow"
        >
          {manifest.years.map((y) => (
            <option key={y} value={y}>
              {y} · {zoneLabel(y)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 max-w-full flex-col text-[0.82rem] text-mist">
        Scope
        <select
          value={selection.scope}
          onChange={(e) => update({ scope: e.target.value as ScopeId })}
          className="mt-1.5 h-[2.6rem] w-full max-w-full border border-rule-strong bg-night-2 px-3 text-[0.95rem] text-snow sm:w-auto"
        >
          {manifest.scopes.map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
