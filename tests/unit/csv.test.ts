import { test } from "node:test";
import assert from "node:assert/strict";
import { toCSV } from "../../src/lib/csv.ts";

test("CSV: Kopfzeile, Leerwerte, Quoting", () => {
  const out = toCSV([
    { year: 2025, scenario: "base", note: 'a;"b"', cap: null },
    { year: 2026, scenario: "base", note: "x", cap: 1 },
  ]);
  const lines = out.replace("﻿", "").split("\r\n");
  assert.equal(lines[0], "year;scenario;note;cap");
  assert.equal(lines[1], '2025;base;"a;""b""";');
  assert.equal(lines[2], "2026;base;x;1");
});
