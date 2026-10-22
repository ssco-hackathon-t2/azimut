"use client";

import { useId } from "react";
import type { Run, ScenarioId } from "@/lib/contract";
import { REASON_LABELS } from "@/lib/labels";
import { fmtEurMio, fmtNum, fmtPct, fmtT } from "@/lib/format";
import { EvidenceCard } from "./EvidenceCard";

/** Kernbotschaft wie app/pages/1_Antwort.py, Punkte 1–3; jede hervorgehobene Zahl öffnet ihre Beleg-Karte. */
export function KeyStatement({
  base,
  current,
  scenarioLabels,
  size = "lg",
}: {
  base: Run;
  current: Run;
  scenarioLabels: Record<ScenarioId, string>;
  size?: "lg" | "md";
}) {
  const uid = useId();
  const st = Object.fromEntries(base.stages.map((s) => [s.name, s]));
  if (!st.E0 || !st.E1 || !st.E2) return <p className="text-mist">Die Stufen E0 bis E2 fehlen im Headline-Run.</p>;
  const by = base.basis.basis_year;
  // Größter E2-Ausschluss nach Masse: Auswahl unter gelieferten Gründen, keine Berechnung.
  const e2Reasons = base.reasons.filter((r) => r.stage === "E2").sort((a, b) => b.mass_kg - a.mass_kg);
  const top = e2Reasons[0];
  const sc = current.params.scenario;
  // Karten liegen außerhalb der <p>-Absätze (ein <div popover> in <p> wäre ungültiges HTML).
  const cards = [
    { kpi: "e0_mass", run: base },
    { kpi: "e2_share_mass", run: base },
    { kpi: "e3_missions_served", run: current },
    { kpi: "e3_revenue", run: current },
  ].map((c) => ({ ...c, id: `${uid}-${c.kpi}` }));
  const card = (kpi: string) => cards.find((c) => c.kpi === kpi)!.id;
  const big = size === "lg" ? "text-[clamp(1.35rem,2.4vw,2rem)] leading-[1.32]" : "text-[1.2rem] leading-[1.45]";

  return (
    <div className={`${big} max-w-[46rem] font-normal text-snow`}>
      <p>
        Von <Num card={card("e0_mass")}>{fmtT(st.E0.mass_kg)}</Num> Nutzlastmasse, die {by} global gestartet wurde, sind{" "}
        <Num card={card("e2_share_mass")} accent>
          {fmtPct(st.E2.share_mass, 2)}
        </Num>{" "}
        von Andøya mit Spectrum adressierbar ({fmtT(st.E2.mass_kg)}, {fmtNum(st.E2.count)} Nutzlasten).
      </p>
      <p className="mt-[0.6em] text-mist">
        Technisch erreichbar sind {fmtPct(st.E1.share_mass, 2)}; der größte Marktausschluss danach ist{" "}
        {top ? `${REASON_LABELS[top.reason] ?? top.reason} (${fmtT(top.mass_kg)})` : "–"}.
      </p>
      <p className="mt-[0.6em]">
        Gewinnbar sind im Szenario „{scenarioLabels[sc] ?? sc}“ für {current.params.year} rund{" "}
        <Num card={card("e3_missions_served")} win>
          {fmtNum(current.e3.missions_served, 1)} Missionen
        </Num>{" "}
        pro Jahr mit <Num card={card("e3_revenue")}>{fmtEurMio(current.e3.revenue_eur)}</Num> Umsatz.
      </p>
      {cards.map((c) => (
        <EvidenceCard key={c.id} id={c.id} kpi={c.kpi} run={c.run} />
      ))}
    </div>
  );
}

function Num({ children, card, accent, win }: { children: React.ReactNode; card: string; accent?: boolean; win?: boolean }) {
  return (
    <button
      type="button"
      popoverTarget={card}
      aria-haspopup="dialog"
      title="Woher kommt diese Zahl?"
      className={`num cursor-pointer font-semibold underline decoration-dotted decoration-1 underline-offset-[0.2em] hover:decoration-solid ${
        win ? "text-aurora" : accent ? "text-ice" : "text-snow"
      }`}
    >
      {children}
    </button>
  );
}
