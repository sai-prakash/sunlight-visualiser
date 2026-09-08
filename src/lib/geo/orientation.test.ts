import assert from "node:assert/strict";
import { test } from "node:test";
import { attitudeFromEuler, OneEuro } from "./orientation.ts";

function near(actual: number, expected: number, tol: number, label: string) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} vs ${expected}`);
}

test("upright phone, camera north: heading 0 pitch 0", () => {
  const a = attitudeFromEuler(0, 90, 0, 0);
  near(a.heading, 0, 0.6, "heading");
  near(a.pitch, 0, 0.6, "pitch");
});

test("upright phone looking up 45°", () => {
  const a = attitudeFromEuler(0, 135, 0, 0);
  near(a.heading, 0, 0.8, "heading");
  near(a.pitch, 45, 0.8, "pitch");
});

test("upright phone looking down 45°", () => {
  const a = attitudeFromEuler(0, 45, 0, 0);
  near(a.heading, 0, 0.8, "heading");
  near(a.pitch, -45, 0.8, "pitch");
});

test("alpha 270 with upright phone faces east (90°)", () => {
  const a = attitudeFromEuler(270, 90, 0, 0);
  near(a.heading, 90, 0.8, "heading");
  near(a.pitch, 0, 0.8, "pitch");
});

test("flat on table looks down", () => {
  const a = attitudeFromEuler(0, 0, 0, 0);
  near(a.pitch, -90, 1.2, "pitch");
});

test("1€ filter damps a spike then settles", () => {
  const f = new OneEuro(1.2, 0.04, 1);
  let y = 0;
  for (let i = 0; i < 8; i++) y = f.filter(10, i * 16, true);
  near(y, 10, 1.5, "settle");
  const spiked = f.filter(80, 8 * 16, true);
  assert.ok(spiked < 72 && spiked > 20, `spike ${spiked}`);

});
