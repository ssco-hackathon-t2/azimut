import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTables, fmtValue, refsIn, resolve, splitTokens, unionCount, type SitesCompare, type Story, type Tables } from "../../src/lib/story-core.ts";

const t: Tables = {
  derived_kpis: [{ id: "share", value_base: "0.0892", unit: "share", label: "Anteil", data_status: "abgeleitet" }],
  market_metrics: [{ id: "mm_012", value: "329", data_status: "belegt" }],
  launch_vehicles: [{ id: "spectrum", payload_leo_kg: "1000", first_flight: "2025-03-30" }],
  sites: [{ id: "andoya", e3: 9.6 }],
};

test("Story: Verweise auf Kennzahl, Tabellenzelle und Datum", () => {
  const p = splitTokens("A {{share}} B {{launch_vehicles:spectrum:payload_leo_kg}} C {{launch_vehicles:spectrum:first_flight}}", t);
  assert.deepEqual(p.map((x) => (typeof x === "string" ? x : x.text)), ["A ", "8.9%", " B ", "1,000", " C ", "30 Mar 2025"]);
});

test("Story: fehlender Verweis bleibt sichtbar statt 0", () => {
  const [x] = splitTokens("{{gibt_es_nicht}}", t);
  assert.ok(typeof x !== "string" && x.missing && x.text.includes("missing"));
  assert.equal(resolve(t, "sites:andoya:e3", "market_metrics:mm_999:value"), null);
});

test("Story: Verhältnis aus zwei Verweisen ist abgeleitet, Stellen fest aus dem Zielwert", () => {
  const r = resolve(t, "sites:andoya:e3", "market_metrics:mm_012:value")!;
  assert.equal(r.status, "abgeleitet");
  assert.equal(fmtValue(r.value, "pct", 0), "3%");
  // Hochzählen: Zwischenwerte nutzen die Stellen des Zielwerts (9.6 → eine Stelle).
  assert.equal(fmtValue(4, "num", undefined, 9.6), "4.0");
});

test("Standorte: Union nur aus gelieferten Daten", () => {
  const sc = { union_e2_count: 451, sites: [{ id: "a", e2_count: 406 }, { id: "b", e2_count: 451 }, { id: "c", e2_count: 406 }] } as unknown as SitesCompare;
  assert.equal(unionCount(sc, new Set(["b"])), 451);
  assert.equal(unionCount(sc, new Set(["a", "b", "c"])), 451);
  assert.equal(unionCount(sc, new Set(["a", "c"])), null);
  assert.equal(unionCount({ ...sc, unions: { "a+c": 410 } }, new Set(["c", "a"])), 410);
});

test("story.json: jeder Verweis existiert in den ausgelieferten Daten", () => {
  const story = JSON.parse(readFileSync(new URL("../../public/data/story.json", import.meta.url), "utf8")) as Story;
  const db = JSON.parse(readFileSync(new URL("../../public/data/isar/isar_data.json", import.meta.url), "utf8")) as Tables;
  const sc = JSON.parse(readFileSync(new URL("../../public/data/sites/sites_compare.json", import.meta.url), "utf8")) as SitesCompare;
  const all = buildTables(db, sc);
  const texts = [story.hero.title, story.hero.lead ?? "", story.hero.claim ?? ""];
  for (const c of story.chapters) {
    texts.push(c.title, c.lead ?? "");
    for (const k of c.kpis ?? []) {
      assert.ok(resolve(all, k.ref, k.of), `${c.id}: Kennzahl ${k.ref}${k.of ? ` / ${k.of}` : ""} fehlt`);
      texts.push(k.note ?? "");
    }
    for (const b of c.blocks ?? []) if ("text" in b) texts.push(b.text);
  }
  for (const ref of texts.flatMap(refsIn)) assert.ok(resolve(all, ref), `Verweis ${ref} fehlt`);
});
