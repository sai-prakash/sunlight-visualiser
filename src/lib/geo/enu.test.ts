import assert from "node:assert/strict";
import { test } from "node:test";
import { enuToScene, geodeticToEnu } from "./enu.ts";

test("1° of latitude is about 111.3 km north", () => {
  const e = geodeticToEnu(13.9344, 77.6114, 0, 12.9344, 77.6114, 0);
  assert.ok(Math.abs(e.north - 111320) < 50, `north ${e.north}`);
  assert.ok(Math.abs(e.east) < 1, `east ${e.east}`);
});

test("scene maps north to −Z and east to +X", () => {
  const s = enuToScene({ east: 4, north: 3, up: 15 });
  assert.equal(s.x, 4);
  assert.equal(s.y, 15);
  assert.equal(s.z, -3);
});
