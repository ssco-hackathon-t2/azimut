import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, validateCharts, viewOptions, type ChartsFile } from "../../src/components/charts/panels/registry.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../public/${p}`, import.meta.url), "utf-8"));
const charts: ChartsFile = read("data/charts.json");
const P = { accent: "#f00", ink: "#fff", mist: "#999", muted: "#333", rule: "#222", font: "x", mono: "y" };

test("Baukasten: charts.json passt zu den Bausteinen", () => {
  assert.deepEqual(validateCharts(charts), []);
});

test("Baukasten: jede Ansicht jedes Panels baut ein Diagramm oder eine Tabelle", () => {
  for (const [id, panel] of Object.entries(charts.panels)) {
    const data = Object.fromEntries(Object.entries(panel.sources).map(([alias, path]) => [alias, read(path)]));
    for (const view of panel.views) {
      const out = KINDS[view.kind](data, viewOptions(view), P);
      assert.ok(out.option || out.table, `${id}/${view.id} liefert nichts`);
      for (const c of view.controls ?? []) {
        for (const [val] of c.values) KINDS[view.kind](data, viewOptions(view, { [c.key]: val }), P);
      }
    }
  }
});

test("Baukasten: Standortbalken zeigen Andøya als einzigen Akzent", () => {
  const sites = read("data/sites/sites_compare.json");
  const out = KINDS["sites-bars"]({ sites }, { metric: "e2_count" }, P);
  const bars = (out.option!.series as any[])[0].data as { itemStyle: { color: string } }[];
  assert.equal(bars.filter((b) => b.itemStyle.color === P.accent).length, 1);
});

test("Baukasten: unbekannter Baustein fällt in der Prüfung auf", () => {
  const bad: ChartsFile = { version: 1, panels: { x: { title: "x", sources: {}, views: [{ id: "a", label: "a", kind: "gibt-es-nicht" }] } } };
  assert.ok(validateCharts(bad).some((e) => e.includes("unbekannter Baustein")));
});
