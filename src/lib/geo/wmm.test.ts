import assert from "node:assert/strict";
import { test } from "node:test";
import { magneticDeclination, trueHeadingFromMagnetic } from "./wmm.ts";

test("Bengaluru 2026 declination is a small west value", () => {
  const d = magneticDeclination(12.9344, 77.6114, 2026);
  assert.ok(d > -4 && d < 1, `BLR decl ${d}`);
});

test("New York 2026 declination is west of true north", () => {
  const d = magneticDeclination(40.7128, -74.006, 2026);
  assert.ok(d > -18 && d < -8, `NYC decl ${d}`);
});

test("San Francisco 2026 declination is east of true north", () => {
  const d = magneticDeclination(37.7749, -122.4194, 2026);
  assert.ok(d > 8 && d < 18, `SF decl ${d}`);
});

test("London 2026 declination is near zero, slightly east", () => {
  const d = magneticDeclination(51.5074, -0.1278, 2026);
  assert.ok(d > -2 && d < 4, `LON decl ${d}`);
});

test("true heading wraps and applies east-positive declination", () => {
  assert.equal(trueHeadingFromMagnetic(10, -2).toFixed(0), "8");
  assert.ok(Math.abs(trueHeadingFromMagnetic(350, 20) - 10) < 1e-9);
});
