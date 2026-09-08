import assert from "node:assert/strict";
import { test } from "node:test";
import { solarPosition, sunTimes } from "./spa.ts";

test("Bengaluru summer solstice noon is high and slightly north", () => {
  // 2026-06-21 12:20 IST = 06:50 UTC, near solar noon at 77.6°E
  const date = new Date(Date.UTC(2026, 5, 21, 6, 50, 0));
  const pos = solarPosition(date, 12.93, 77.61, 900);
  assert.ok(pos.declination > 23 && pos.declination < 24, `decl ${pos.declination}`);
  assert.ok(pos.altitude > 76 && pos.altitude < 82, `alt ${pos.altitude}`);
  // decl > lat → sun is north of zenith at noon
  assert.ok(pos.azimuth < 40 || pos.azimuth > 320, `az ${pos.azimuth}`);
});

test("Bengaluru winter solstice noon is from the south", () => {
  const date = new Date(Date.UTC(2026, 11, 21, 6, 50, 0));
  const pos = solarPosition(date, 12.93, 77.61, 900);
  assert.ok(pos.altitude > 50 && pos.altitude < 58, `alt ${pos.altitude}`);
  assert.ok(pos.azimuth > 150 && pos.azimuth < 210, `az ${pos.azimuth}`);
});

test("sunrise is before sunset", () => {
  const t = sunTimes(new Date(Date.UTC(2026, 8, 22, 6, 0, 0)), 12.93, 77.61, 900);
  assert.ok(t.sunrise.getTime() < t.solarNoon.getTime());
  assert.ok(t.solarNoon.getTime() < t.sunset.getTime());
  const hours = (t.sunset.getTime() - t.sunrise.getTime()) / 3600000;
  assert.ok(hours > 10 && hours < 14, `day length ${hours}`);
});
