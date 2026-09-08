import { uid } from "@/lib/utils";
import { decimalYear, magneticDeclination } from "@/lib/geo/wmm";
import { emptyHorizon } from "@/lib/solar/occlusion";
import type { Blocker, Site, Space, WalkSession } from "@/lib/solar/types";

/** A south-facing fifth-floor terrace with a taller east tower — the classic home-buyer trap. */
export function demoSite(): Site {
  const lat = 12.9344;
  const lon = 77.6114;
  return {
    lat,
    lon,
    elevation: 912,
    label: "Koramangala · sample plot",
    timezone: "Asia/Kolkata",
    magDeclination: magneticDeclination(lat, lon, decimalYear()),
  };
}

export function demoSpaces(): Space[] {
  return [
    {
      id: uid("space"),
      name: "South terrace",
      cx: 0,
      cz: 1.4,
      width: 5.4,
      depth: 3.2,
      rotation: 0,
      elevation: 15.2,
    },
  ];
}

export function demoBlockers(): Blocker[] {
  return [
    {
      id: uid("blk"),
      name: "Own building",
      kind: "building",
      cx: 0,
      cz: -6.4,
      width: 14,
      depth: 11,
      height: 18.4,
      rotation: 0,
      baseElevation: 0,
      source: "demo",
    },
    {
      id: uid("blk"),
      name: "East tower",
      kind: "building",
      cx: 22.5,
      cz: -2,
      width: 16,
      depth: 18,
      height: 44,
      rotation: 8,
      baseElevation: 0,
      source: "demo",
    },
    {
      id: uid("blk"),
      name: "West wing",
      kind: "building",
      cx: -18,
      cz: 4,
      width: 12,
      depth: 14,
      height: 22,
      rotation: -6,
      baseElevation: 0,
      source: "demo",
    },
    {
      id: uid("blk"),
      name: "North block",
      kind: "building",
      cx: 3,
      cz: -22,
      width: 22,
      depth: 10,
      height: 27,
      rotation: 2,
      baseElevation: 0,
      source: "demo",
    },
  ];
}

export function demoWalk(): WalkSession {
  const y = 16.6;
  const pts = [
    { x: 0.2, z: 2.4 },
    { x: 1.8, z: 2.1 },
    { x: 2.2, z: 0.4 },
    { x: 1.4, z: -1.6 },
    { x: -0.2, z: -2.4 },
    { x: -1.6, z: -1.2 },
    { x: -2.0, z: 0.8 },
    { x: -0.8, z: 2.2 },
    { x: 0.2, z: 2.4 },
  ];
  return {
    id: uid("walk"),
    name: "Terrace loop",
    closed: true,
    points: pts.map((p, i) => ({ ...p, y, t: i * 900 })),
  };
}

export function demoHorizon(): number[] {
  return emptyHorizon();
}
