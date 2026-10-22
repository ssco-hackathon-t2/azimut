import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// /kosten vergleicht nur gelieferte Werte. Damit Überschrift und Regler sich nie widersprechen, muss die
// Kostenkurve der DB genau beim gelieferten Break-even unter den Preis fallen.
const db = JSON.parse(readFileSync(new URL("../../public/data/isar/isar_data.json", import.meta.url), "utf8"));
const curve = db.cost_curve.map((r: Record<string, string>) => ({ n: Number(r.launches_per_year), cost: Number(r.cost_per_launch_eur_m) })).sort((a: { n: number }, b: { n: number }) => a.n - b.n);
const base = (rows: Record<string, string>[], id: string) => Number(rows.find((r) => r.id === id)?.value_base);

test("Kostenkurve fällt genau beim gelieferten Break-even unter den Preis", () => {
  const price = base(db.assumptions, "price_per_launch_eur_m");
  const firstCovered = curve.find((r: { cost: number }) => r.cost <= price)?.n;
  assert.equal(firstCovered, base(db.derived_kpis, "break_even_ops"));
});

test("Jedes Szenario liegt auf einer Stützstelle der Kurve, auch der Startpunkt", () => {
  const ns = new Set(curve.map((r: { n: number }) => r.n));
  for (const s of db.scenarios) assert.ok(ns.has(Number(s.launches_total)), `${s.id}: ${s.launches_total} Starts fehlen in cost_curve`);
  assert.ok(db.scenarios.some((s: { id: string }) => s.id === "nachfrage_realistisch"));
});
