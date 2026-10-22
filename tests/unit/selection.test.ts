import { test } from "node:test";
import assert from "node:assert/strict";
import { belegeHref, carryQuery, parseSelection, runId, selectionQuery } from "../../src/lib/selection-core.ts";

const manifest = { years: [2025, 2027, 2030, 2035] } as never;

test("Auswahl aus URL: gültige Werte übernehmen, ungültige auf Standard", () => {
  const s = parseSelection(new URLSearchParams("szenario=optimistic&jahr=2030&scope=open_market"), manifest);
  assert.deepEqual(s, { scenario: "optimistic", year: 2030, scope: "open_market" });
  const bad = parseSelection(new URLSearchParams("szenario=x&jahr=1999&scope=y"), manifest);
  assert.deepEqual(bad, { scenario: "base", year: 2025, scope: "all_payloads" });
});

test("Run-ID entspricht dem Fixture-Schema", () => {
  assert.equal(runId({ scenario: "base", year: 2025, scope: "all_payloads" }), "andoya_all_payloads_2025_base");
});

test("Standardauswahl erzeugt keine Query, Rundweg URL -> Auswahl", () => {
  assert.equal(selectionQuery({ scenario: "base", year: 2025, scope: "all_payloads" }), "");
  const s = { scenario: "conservative" as const, year: 2035, scope: "non_captive" as const };
  assert.deepEqual(parseSelection(new URLSearchParams(selectionQuery(s).slice(1)), manifest), s);
});

test("Navigation reicht Auswahl unverändert weiter, kpi nicht", () => {
  assert.equal(carryQuery(new URLSearchParams("szenario=conservative&jahr=2030&kpi=e3_revenue")), "?szenario=conservative&jahr=2030");
  assert.equal(carryQuery(new URLSearchParams("")), "");
});

test("Beleg-Link hängt kpi korrekt an", () => {
  assert.equal(belegeHref("e2_share_mass", { scenario: "base", year: 2025, scope: "all_payloads" }), "/belege/?kpi=e2_share_mass");
  assert.equal(belegeHref("e3_revenue", { scenario: "base", year: 2030, scope: "all_payloads" }), "/belege/?jahr=2030&kpi=e3_revenue");
});
