import { solarPosition, sunDirection, sunTimes, withFractionalHour } from "./spa";
import { litFraction } from "./occlusion";
import type { Blocker, DaySample, DaySummary, Site, Space, YearDay } from "./types";

const STEP_MIN = 10;

export function analyzeDay(
  date: Date,
  site: Site,
  spaces: Space[],
  blockers: Blocker[],
  horizon: number[],
): DaySummary {
  const times = sunTimes(date, site.lat, site.lon, site.elevation);
  const space = spaces[0];
  const samples: DaySample[] = [];
  if (!space) {
    return {
      date,
      sunrise: times.sunrise,
      sunset: times.sunset,
      hoursDirect: 0,
      hoursAny: 0,
      peakLit: 0,
      firstDirect: null,
      lastDirect: null,
      samples,
      dominantBlocker: null,
    };
  }

  const start = times.dawn.getTime();
  const end = times.dusk.getTime();
  const step = STEP_MIN * 60_000;
  let hoursDirect = 0;
  let hoursAny = 0;
  let peakLit = 0;
  let firstDirect: Date | null = null;
  let lastDirect: Date | null = null;
  const blockerHours = new Map<string, number>();

  for (let t = start; t <= end; t += step) {
    const d = new Date(t);
    const pos = solarPosition(d, site.lat, site.lon, site.elevation);
    const dir = sunDirection(pos.azimuth, pos.altitude);
    const sunDir = { x: dir[0], y: dir[1], z: dir[2] };
    const { fraction, blockedBy } = litFraction(
      space,
      sunDir,
      pos.azimuth,
      pos.altitude,
      blockers,
      horizon,
      6,
      4,
    );
    samples.push({
      minutes: d.getHours() * 60 + d.getMinutes(),
      altitude: pos.altitude,
      azimuth: pos.azimuth,
      litFraction: fraction,
      blockedBy,
    });
    const dt = STEP_MIN / 60;
    if (pos.altitude > -0.833) hoursAny += dt * Math.max(fraction, 0.0001);
    if (fraction > 0.15) {
      hoursDirect += dt * fraction;
      if (!firstDirect) firstDirect = d;
      lastDirect = d;
    }
    if (fraction > peakLit) peakLit = fraction;
    if (blockedBy && fraction < 0.85 && pos.altitude > 2) {
      blockerHours.set(blockedBy, (blockerHours.get(blockedBy) ?? 0) + dt * (1 - fraction));
    }
  }

  let dominantBlocker: string | null = null;
  let best = 0.35;
  for (const [name, h] of blockerHours) {
    if (h > best) {
      best = h;
      dominantBlocker = name;
    }
  }

  return {
    date,
    sunrise: times.sunrise,
    sunset: times.sunset,
    hoursDirect,
    hoursAny,
    peakLit,
    firstDirect,
    lastDirect,
    samples,
    dominantBlocker,
  };
}

export function analyzeYear(
  year: number,
  site: Site,
  spaces: Space[],
  blockers: Blocker[],
  horizon: number[],
): YearDay[] {
  const days: YearDay[] = [];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const total = leap ? 366 : 365;
  // Every 3 days is visually dense and still captures solstice curvature.
  for (let doy = 1; doy <= total; doy += 2) {
    const d = new Date(year, 0, doy, 12, 0, 0);
    const summary = analyzeDay(d, site, spaces, blockers, horizon);
    days.push({
      doy,
      month: d.getMonth(),
      day: d.getDate(),
      hoursDirect: summary.hoursDirect,
      firstHour: summary.firstDirect ? summary.firstDirect.getHours() + summary.firstDirect.getMinutes() / 60 : null,
      lastHour: summary.lastDirect ? summary.lastDirect.getHours() + summary.lastDirect.getMinutes() / 60 : null,
    });
  }
  return days;
}

export function solsticeDates(year: number): { summer: Date; winter: Date; spring: Date; autumn: Date } {
  return {
    spring: new Date(year, 2, 20, 12, 0, 0),
    summer: new Date(year, 5, 21, 12, 0, 0),
    autumn: new Date(year, 8, 22, 12, 0, 0),
    winter: new Date(year, 11, 21, 12, 0, 0),
  };
}

export function insightCopy(summary: DaySummary, winterH: number, summerH: number): string {
  const h = summary.hoursDirect;
  const parts: string[] = [];
  if (h < 0.15) {
    parts.push("No meaningful direct sun today on the marked space.");
  } else {
    const first = summary.firstDirect
      ? summary.firstDirect.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;
    const last = summary.lastDirect
      ? summary.lastDirect.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;
    if (first && last) {
      parts.push(`Direct sun ${first}–${last}.`);
    }
  }
  if (summary.dominantBlocker) {
    parts.push(`${summary.dominantBlocker} is the main cut.`);
  }
  if (Number.isFinite(winterH) && Number.isFinite(summerH)) {
    if (winterH > summerH + 0.8) {
      parts.push(`Winter solstice ${winterH.toFixed(1)}h · summer ${summerH.toFixed(1)}h — a south opening with a north mass behind it.`);
    } else {
      parts.push(`Winter solstice ${winterH.toFixed(1)}h · summer ${summerH.toFixed(1)}h.`);
    }
  }
  return parts.join(" ");
}

export { withFractionalHour };
