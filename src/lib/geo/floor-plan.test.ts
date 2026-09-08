import assert from "node:assert/strict";
import { test } from "node:test";
import { floorPlanCorners, rotateEnu, sizeFromAspect } from "./floor-plan.ts";
import type { FloorPlan } from "../solar/types.ts";

test("zero yaw keeps local east as east", () => {
  const r = rotateEnu(4, 0, 0);
  assert.ok(Math.abs(r.east - 4) < 1e-9);
  assert.ok(Math.abs(r.north) < 1e-9);
});

test("90° clockwise sends local east to south", () => {
  const r = rotateEnu(4, 0, 90);
  assert.ok(Math.abs(r.east) < 1e-9, `east ${r.east}`);
  assert.ok(Math.abs(r.north + 4) < 1e-9, `north ${r.north}`);
});

test("plan corners at origin are a north-aligned rectangle", () => {
  const plan: FloorPlan = {
    src: "",
    pixelW: 100,
    pixelH: 50,
    east: 0,
    north: 0,
    widthM: 10,
    depthM: 4,
    rotation: 0,
    opacity: 1,
  };
  const c = floorPlanCorners(plan);
  const norths = c.map((p) => p.north);
  assert.ok(Math.max(...norths) > 1.9);
  assert.ok(Math.min(...norths) < -1.9);
});

test("aspect keeps the long side", () => {
  const wide = sizeFromAspect(2000, 1000, 24);
  assert.ok(Math.abs(wide.widthM - 24) < 1e-9);
  assert.ok(Math.abs(wide.depthM - 12) < 1e-9);
  const tall = sizeFromAspect(1000, 2000, 24);
  assert.ok(Math.abs(tall.depthM - 24) < 1e-9);
  assert.ok(Math.abs(tall.widthM - 12) < 1e-9);
});
