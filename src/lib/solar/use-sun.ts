import { useMemo } from "react";
import { useSolara } from "@/lib/store";
import { solarPosition, sunDirection, sunTimes } from "./spa";
import { emptyHorizon, litFraction, mergeHorizon, rasterizeBlockers } from "./occlusion";
import { pickSpace } from "./year";

export function useSiteHorizon() {
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const userHorizon = useSolara((s) => s.userHorizon);
  const selectedId = useSolara((s) => s.selectedId);
  const floorHeight = useSolara((s) => s.floorHeight);

  return useMemo(() => {
    const horizon = emptyHorizon();
    const space = pickSpace(spaces, selectedId);
    const origin = space
      ? { x: space.cx, y: space.elevation + 0.05, z: space.cz }
      : { x: 0, y: floorHeight, z: 0 };
    rasterizeBlockers(origin, blockers, horizon);
    return mergeHorizon(horizon, userHorizon);
  }, [spaces, blockers, userHorizon, selectedId, floorHeight]);
}

export function useSunNow() {
  const now = useSolara((s) => s.now);
  const site = useSolara((s) => s.site);
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const selectedId = useSolara((s) => s.selectedId);
  const horizon = useSiteHorizon();

  return useMemo(() => {
    const date = new Date(now);
    const pos = solarPosition(date, site.lat, site.lon, site.elevation);
    const times = sunTimes(date, site.lat, site.lon, site.elevation);
    const dirT = sunDirection(pos.azimuth, pos.altitude);
    const dir = { x: dirT[0], y: dirT[1], z: dirT[2] };
    const space = pickSpace(spaces, selectedId);
    const lit = space
      ? litFraction(space, dir, pos.azimuth, pos.altitude, blockers, horizon)
      : { fraction: 0, blockedBy: null as string | null };
    return { date, pos, times, lit, horizon, dir, space };
  }, [now, site, spaces, blockers, selectedId, horizon]);
}
