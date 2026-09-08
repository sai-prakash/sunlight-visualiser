import assert from "node:assert/strict";
import { test } from "node:test";
import { buildingsFromOsm, parseHeight } from "./osm-buildings.ts";

test("height prefers metres, then storeys", () => {
  assert.equal(parseHeight({ height: "21.5" }), 21.5);
  assert.ok(Math.abs(parseHeight({ "building:levels": "4" }) - 12.4) < 1e-9);
  assert.equal(parseHeight({}), 12);
});

test("way with four nodes becomes an ENU box", () => {
  const data = {
    elements: [
      { type: "node", id: 1, lat: 12.9345, lon: 77.6114 },
      { type: "node", id: 2, lat: 12.9345, lon: 77.6116 },
      { type: "node", id: 3, lat: 12.9343, lon: 77.6116 },
      { type: "node", id: 4, lat: 12.9343, lon: 77.6114 },
      {
        type: "way",
        id: 99,
        nodes: [1, 2, 3, 4],
        tags: { building: "apartments", "building:levels": "8", name: "East tower" },
      },
    ],
  };
  const b = buildingsFromOsm(data, 12.9344, 77.6114);
  assert.equal(b.length, 1);
  assert.equal(b[0]?.name, "East tower");
  assert.ok((b[0]?.height ?? 0) > 20);
  assert.equal(b[0]?.source, "osm");
  assert.ok((b[0]?.width ?? 0) > 4);
});
