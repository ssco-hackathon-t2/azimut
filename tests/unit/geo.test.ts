import { test } from "node:test";
import assert from "node:assert/strict";
import { destination, distanceKm, flightPose, gmstDeg, latLonToVec, sectorOutline, subsolarPoint } from "../../src/lib/geo.ts";

test("Sonnenstand: Tagundnachtgleiche März 2025 mittags UTC nahe Äquator und Nullmeridian", () => {
  // 20.03.2025 09:01 UTC Äquinoktium; 12:00 UTC -> Deklination ~ +0,05°. Zeitgleichung −7,5 min:
  // wahrer Mittag erst 12:07 UTC, um 12:00 steht die Sonne also ~1,9° östlich von Greenwich.
  const [lat, lon] = subsolarPoint(new Date("2025-03-20T12:00:00Z"));
  assert.ok(Math.abs(lat - 0.05) < 0.3, `lat=${lat}`);
  assert.ok(Math.abs(lon - 1.9) < 0.5, `lon=${lon}`);
});

test("Sternzeit J2000.0 = 280,46°", () => {
  assert.ok(Math.abs(gmstDeg(new Date("2000-01-01T12:00:00Z")) - 280.46061837) < 1e-6);
});

const PAD = { lat: 69.10843, lon: 15.58929 };

test("latLonToVec liegt auf der Einheitskugel, Nordpol = +y", () => {
  const v = latLonToVec(PAD.lat, PAD.lon);
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12);
  const np = latLonToVec(90, 0);
  assert.ok(Math.abs(np[1] - 1) < 1e-12);
});

test("destination und distanceKm sind konsistent", () => {
  const [la, lo] = destination(PAD.lat, PAD.lon, 320, 10);
  assert.ok(Math.abs(distanceKm(PAD.lat, PAD.lon, la, lo) - 10) < 1e-6);
  // Peilung 0 = Norden: Breite steigt, Länge bleibt
  const [la2, lo2] = destination(PAD.lat, PAD.lon, 0, 5);
  assert.ok(la2 > PAD.lat && Math.abs(lo2 - PAD.lon) < 1e-9);
});

test("Oksebåsen liegt rund 26,8 km vom Pad (Recherche-Abgleich)", () => {
  const d = distanceKm(PAD.lat, PAD.lon, 69.2946, 16.022);
  assert.ok(Math.abs(d - 26.8) < 0.3, `d=${d}`);
});

test("Sektor 280–360° beginnt und endet am Pad, Bogen hat konstanten Radius", () => {
  const pts = sectorOutline(PAD.lat, PAD.lon, 280, 360, 4, 16);
  assert.deepEqual(pts[0], [PAD.lat, PAD.lon]);
  assert.deepEqual(pts[pts.length - 1], [PAD.lat, PAD.lon]);
  for (const [la, lo] of pts.slice(1, -1)) assert.ok(Math.abs(distanceKm(PAD.lat, PAD.lon, la, lo) - 4) < 1e-6);
});

test("Kamerapfad: Start und Ziel exakt, Höhe monoton fallend", () => {
  const spec = { start: { lat: 40, lon: -10, alt: 3 }, target: { ...PAD, alt: 0.0003, tilt: 38, heading: 320 } };
  const a = flightPose(spec, 0);
  const b = flightPose(spec, 1);
  assert.ok(Math.abs(a.alt - 3) < 1e-12);
  assert.ok(Math.abs(b.alt - 0.0003) < 1e-12 && b.lat === PAD.lat && b.tilt === 38);
  let prev = Infinity;
  for (let i = 0; i <= 50; i++) {
    const p = flightPose(spec, i / 50);
    assert.ok(p.alt <= prev + 1e-15);
    prev = p.alt;
  }
});
