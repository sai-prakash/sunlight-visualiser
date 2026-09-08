import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cameraBasis,
  displayedFov,
  projectAzAlt,
  sunLockOffset,
  unprojectPixel,
} from "./project.ts";

test("portrait object-cover narrows horizontal FOV vs the landscape video", () => {
  const fov = displayedFov(1920, 1080, 390, 844, 26);
  assert.ok(fov.hfov > 18 && fov.hfov < 50, `hfov ${fov.hfov}`);
  assert.ok(fov.vfov > 35 && fov.vfov < 85, `vfov ${fov.vfov}`);
});

test("a target on the look axis projects to the image centre", () => {
  const p = projectAzAlt(40, 12, 40, 12, 0, 400, 800, 40, 70);
  assert.ok(Math.abs(p.x - 200) < 1, `x ${p.x}`);
  assert.ok(Math.abs(p.y - 400) < 1, `y ${p.y}`);
  assert.equal(p.onScreen, true);
});

test("unproject of centre returns the camera heading and pitch", () => {
  const u = unprojectPixel(200, 400, 80, 10, 0, 400, 800, 40, 70);
  assert.ok(Math.abs(u.az - 80) < 0.2, `az ${u.az}`);
  assert.ok(Math.abs(u.alt - 10) < 0.2, `alt ${u.alt}`);
});

test("sun lock offset is the residual between the tap ray and the true sun", () => {
  const off = sunLockOffset(100, 112);
  assert.ok(Math.abs(off - 12) < 1e-9, `off ${off}`);
});

test("looking north, a point to the east lands on the right of the frame", () => {
  const p = projectAzAlt(20, 0, 0, 0, 0, 400, 400, 60, 60);
  assert.ok(p.x > 200, `x ${p.x}`);
  assert.equal(p.onScreen, true);
});

test("a target behind the camera is off-screen", () => {
  const p = projectAzAlt(180, 0, 0, 0, 0, 400, 400, 60, 60);
  assert.equal(p.onScreen, false);
});

test("round-trip near centre stays within a tenth of a degree", () => {
  const heading = 123.4;
  const pitch = 8.2;
  const p = projectAzAlt(125, 9, heading, pitch, 0, 800, 600, 50, 40);
  const u = unprojectPixel(p.x, p.y, heading, pitch, 0, 800, 600, 50, 40);
  assert.ok(Math.abs(u.az - 125) < 0.12, `az ${u.az}`);
  assert.ok(Math.abs(u.alt - 9) < 0.12, `alt ${u.alt}`);
});

test("north-looking camera has east as +X", () => {
  const b = cameraBasis(0, 0, 0);
  assert.ok(Math.abs(b.right.e - 1) < 1e-9);
  assert.ok(Math.abs(b.forward.n - 1) < 1e-9);
  assert.ok(Math.abs(b.up.u - 1) < 1e-9);
});
