import test from "node:test";
import assert from "node:assert/strict";
import { resultURL } from "../../src/lib/data-source.ts";

test("Live-Auswahl erreicht die API; Beleg-ID ist kein Rechenparameter", () => {
  assert.equal(resultURL("runs.json", "jahr=2030&szenario=optimistic&scope=open_market&kpi=e3_count", "", "live"),
    "/api/runs.json?jahr=2030&szenario=optimistic&scope=open_market");
  assert.equal(resultURL("timeline.json", "jahr=2030&scope=open_market", "", "live"), "/api/timeline.json?scope=open_market");
  assert.equal(resultURL("manifest.json", "jahr=2030", "", "live"), "/api/manifest.json");
});

test("Offline-Modus bleibt explizit und respektiert den Pages-Unterpfad", () => {
  assert.equal(resultURL("runs.json", "jahr=2030", "/azimut", "fixture"), "/azimut/data/fixture/runs.json");
});

test("Öffentliche API verwendet ihre eigene Origin, nicht den Pages-Unterpfad", () => {
  assert.equal(resultURL("runs.json", "jahr=2030&scope=open_market", "/azimut", "live", "https://api.example.org/"),
    "https://api.example.org/api/runs.json?jahr=2030&scope=open_market");
  assert.equal(resultURL("runs.json", "", "/azimut", "fixture", "https://api.example.org"),
    "/azimut/data/fixture/runs.json");
});
