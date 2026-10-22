import { test } from "node:test";
import assert from "node:assert/strict";
import { alpha } from "../../src/components/charts/theme.ts";

test("Theme: Token-Farbe mit Deckkraft für Canvas", () => {
  assert.equal(alpha("#8fd3ff", 0.16), "rgba(143, 211, 255, 0.16)");
  // Kein Hex (z. B. Token beim Vorrendern noch leer): Wert unverändert durchreichen.
  assert.equal(alpha("", 0.5), "");
});
