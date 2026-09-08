import { wrap360 } from "@/lib/utils";
import type { Blocker, OcclusionHit, Space, Vec3 } from "./types";
import { HORIZON_BINS } from "./types";

const RAD = Math.PI / 180;

export function emptyHorizon(): number[] {
  return new Array<number>(HORIZON_BINS).fill(-0.833);
}

function rotateY(x: number, z: number, deg: number): { x: number; z: number } {
  const r = -deg * RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - z * s, z: x * s + z * c };
}

/** Ray vs oriented box. Direction is toward the sun (unnormalized ok). */
export function rayHitsBlocker(
  origin: Vec3,
  dir: Vec3,
  b: Blocker,
): boolean {
  const dx = origin.x - b.cx;
  const dz = origin.z - b.cz;
  const local = rotateY(dx, dz, -b.rotation);
  const ody = origin.y - (b.baseElevation + b.height / 2);

  const d = rotateY(dir.x, dir.z, -b.rotation);
  const dirL = { x: d.x, y: dir.y, z: d.z };

  const hx = b.width / 2 + 0.02;
  const hy = b.height / 2 + 0.02;
  const hz = b.depth / 2 + 0.02;

  const tmin = [0, 0, 0];
  const tmax = [0, 0, 0];
  const o = [local.x, ody, local.z];
  const v = [dirL.x, dirL.y, dirL.z];
  const h = [hx, hy, hz];

  for (let i = 0; i < 3; i++) {
    const originI = o[i] as number;
    const dirI = v[i] as number;
    const half = h[i] as number;
    if (Math.abs(dirI) < 1e-10) {
      if (originI < -half || originI > half) return false;
      tmin[i] = -1e12;
      tmax[i] = 1e12;
    } else {
      const inv = 1 / dirI;
      let t1 = (-half - originI) * inv;
      let t2 = (half - originI) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tmin[i] = t1;
      tmax[i] = t2;
    }
  }
  const tEnter = Math.max(tmin[0] as number, tmin[1] as number, tmin[2] as number);
  const tExit = Math.min(tmax[0] as number, tmax[1] as number, tmax[2] as number);
  return tExit >= tEnter && tExit > 0.05 && tEnter < 400;
}

export function azimuthOf(dx: number, dz: number): number {
  // +X east, +Z south → atan2(east, north) with north = -Z
  return wrap360((Math.atan2(dx, -dz) * 180) / Math.PI);
}

export function altitudeOf(dy: number, horiz: number): number {
  return (Math.atan2(dy, Math.max(horiz, 1e-6)) * 180) / Math.PI;
}

export function stampHorizonPoint(horizon: number[], az: number, alt: number, spread = 0.6) {
  const a = wrap360(az);
  const i0 = Math.floor(a) % HORIZON_BINS;
  const n = Math.max(1, Math.ceil(spread));
  for (let k = -n; k <= n; k++) {
    const i = (i0 + k + HORIZON_BINS) % HORIZON_BINS;
    const w = 1 - Math.abs(k) / (n + 1);
    const prev = horizon[i] ?? -0.833;
    horizon[i] = Math.max(prev, alt * w + prev * (1 - w) * 0.15);
    if ((horizon[i] ?? 0) < alt && Math.abs(k) <= 1) horizon[i] = alt;
  }
}

function fillHorizonSpan(horizon: number[], az0: number, az1: number, alt: number) {
  let a0 = wrap360(az0);
  let a1 = wrap360(az1);
  let span = wrap360(a1 - a0);
  if (span > 180) {
    const t = a0;
    a0 = a1;
    a1 = t;
    span = wrap360(a1 - a0);
  }
  const steps = Math.max(1, Math.ceil(span));
  for (let s = 0; s <= steps; s++) {
    const az = wrap360(a0 + (span * s) / steps);
    const i = Math.round(az) % HORIZON_BINS;
    const prev = horizon[i] ?? -0.833;
    if (alt > prev) horizon[i] = alt;
  }
}

/** Raise a 360-bin horizon using the silhouette of 3D blockers from a sample point. */
export function rasterizeBlockers(origin: Vec3, blockers: Blocker[], horizon: number[]) {
  for (const b of blockers) {
    const topY = b.baseElevation + b.height;
    const hw = b.width / 2;
    const hd = b.depth / 2;
    const corners: { x: number; z: number }[] = [
      { x: -hw, z: -hd },
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: -hw, z: hd },
    ].map((c) => {
      const r = rotateY(c.x, c.z, b.rotation);
      return { x: b.cx + r.x, z: b.cz + r.z };
    });

    const samples: { az: number; alt: number }[] = [];
    for (const c of corners) {
      const dx = c.x - origin.x;
      const dz = c.z - origin.z;
      const horiz = Math.hypot(dx, dz);
      if (horiz < 0.2) continue;
      samples.push({
        az: azimuthOf(dx, dz),
        alt: altitudeOf(topY - origin.y, horiz),
      });
    }
    // Dense sample along each top edge
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i]!;
      const c = corners[(i + 1) % corners.length]!;
      const edge = Math.hypot(c.x - a.x, c.z - a.z);
      const n = Math.max(2, Math.ceil(edge / 0.8));
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const x = a.x + (c.x - a.x) * t;
        const z = a.z + (c.z - a.z) * t;
        const dx = x - origin.x;
        const dz = z - origin.z;
        const horiz = Math.hypot(dx, dz);
        if (horiz < 0.2) continue;
        samples.push({
          az: azimuthOf(dx, dz),
          alt: altitudeOf(topY - origin.y, horiz),
        });
      }
    }
    if (samples.length === 0) continue;
    samples.sort((p, q) => p.az - q.az);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i]!;
      stampHorizonPoint(horizon, p.az, p.alt, 0.8);
      const q = samples[(i + 1) % samples.length]!;
      let d = wrap360(q.az - p.az);
      if (d > 180) d -= 360;
      if (Math.abs(d) < 40) {
        fillHorizonSpan(horizon, p.az, q.az, Math.min(p.alt, q.alt));
      }
    }
  }
}

export type TerrainSample = { az: number; dist: number; elevation: number };

export function rasterizeTerrain(
  origin: Vec3,
  siteElevation: number,
  samples: TerrainSample[],
  horizon: number[],
) {
  for (const s of samples) {
    const dy = s.elevation - (siteElevation + origin.y);
    const alt = altitudeOf(dy, s.dist);
    if (alt > -1) stampHorizonPoint(horizon, s.az, alt, 3);
  }
}

export function horizonAltitude(horizon: number[], azimuth: number): number {
  const a = wrap360(azimuth);
  const i0 = Math.floor(a) % HORIZON_BINS;
  const i1 = (i0 + 1) % HORIZON_BINS;
  const t = a - Math.floor(a);
  const h0 = horizon[i0] ?? -0.833;
  const h1 = horizon[i1] ?? -0.833;
  return h0 * (1 - t) + h1 * t;
}

export function occludedByHorizon(horizon: number[], azimuth: number, altitude: number): boolean {
  if (altitude < -0.833) return true;
  return altitude < horizonAltitude(horizon, azimuth) - 0.05;
}

export function occlude(
  origin: Vec3,
  sunDir: Vec3,
  azimuth: number,
  altitude: number,
  blockers: Blocker[],
  horizon: number[],
): OcclusionHit {
  if (altitude < -0.833) return { blocked: true, kind: "horizon", by: "Night" };
  for (const b of blockers) {
    if (rayHitsBlocker(origin, sunDir, b)) {
      return { blocked: true, kind: "building", by: b.name };
    }
  }
  if (occludedByHorizon(horizon, azimuth, altitude)) {
    return { blocked: true, kind: "skyline", by: "Skyline" };
  }
  return { blocked: false };
}

export function spaceSamplePoints(space: Space, nx = 8, nz = 6): Vec3[] {
  const points: Vec3[] = [];
  const rot = -space.rotation * RAD;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const u = nx === 1 ? 0.5 : (i + 0.5) / nx;
      const v = nz === 1 ? 0.5 : (j + 0.5) / nz;
      const lx = (u - 0.5) * space.width;
      const lz = (v - 0.5) * space.depth;
      points.push({
        x: space.cx + lx * c - lz * s,
        y: space.elevation + 0.05,
        z: space.cz + lx * s + lz * c,
      });
    }
  }
  return points;
}

export function litFraction(
  space: Space,
  sunDir: Vec3,
  azimuth: number,
  altitude: number,
  blockers: Blocker[],
  horizon: number[],
  nx = 8,
  nz = 6,
): { fraction: number; blockedBy: string | null } {
  if (altitude < -0.833) return { fraction: 0, blockedBy: "Night" };
  const pts = spaceSamplePoints(space, nx, nz);
  let lit = 0;
  const counts = new Map<string, number>();
  for (const p of pts) {
    const hit = occlude(p, sunDir, azimuth, altitude, blockers, horizon);
    if (!hit.blocked) lit += 1;
    else if (hit.by) counts.set(hit.by, (counts.get(hit.by) ?? 0) + 1);
  }
  let blockedBy: string | null = null;
  let best = 0;
  for (const [name, n] of counts) {
    if (n > best) {
      best = n;
      blockedBy = name;
    }
  }
  return { fraction: lit / pts.length, blockedBy };
}

export function mergeHorizon(a: number[], b: number[]): number[] {
  const out = a.slice();
  for (let i = 0; i < HORIZON_BINS; i++) {
    out[i] = Math.max(out[i] ?? -0.833, b[i] ?? -0.833);
  }
  return out;
}
