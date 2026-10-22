"use client";

/** Umschalter für zwei bis vier Ansichten eines Diagramms oder einer Karte. */
export function Toggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <span className="text-[0.82rem] text-mist">{label}</span>
      <div className="flex border border-rule-strong">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 text-[0.88rem] transition-colors duration-200 ${value === v ? "bg-night-3 text-snow shadow-[inset_0_-1px_0_var(--color-ice)]" : "text-mist hover:text-snow"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
