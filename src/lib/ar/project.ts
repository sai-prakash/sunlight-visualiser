import { wrap360, wrapDelta } from "../utils.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** 26 mm-e (typical iPhone / Pixel wide). Diagonal of a 35 mm frame is 43.27 mm. */
const DEFAULT_FOCAL_35 = 26;
const DIAG_35 = 43.27;

export type Fov = { hfov: number; vfov: number; focal35: number };

export function fovFromFocal(aspect: number, focal35 = DEFAULT_FOCAL_35): Fov {
  const a = Math.max(0.2, Math.min(5, aspect));
  const diag = 2 * Math.atan(DIAG_35 / (2 * focal35));
  const hyp = Math.sqrt(1 + a * a);
  const hfov = 2 * Math.atan(Math.tan(diag / 2) * (a / hyp)) * DEG;
  const vfov = 2 * Math.atan(Math.tan(diag / 2) * (1 / hyp)) * DEG;
  return { hfov, vfov, focal35 };
}

/**
 * Visible FOV after CSS object-cover crop of `video` into `element`.
 * This is the mapping the overlay canvas must use — raw sensor FOV is wrong in portrait.
 */
export function displayedFov(
  videoWidth: number,
  videoHeight: number,
  elementWidth: number,
  elementHeight: number,
  focal35 = DEFAULT_FOCAL_35,
): Fov {
  const vw = Math.max(1, videoWidth);
  const vh = Math.max(1, videoHeight);
  const ew = Math.max(1, elementWidth);
  const eh = Math.max(1, elementHeight);
  const intrinsic = fovFromFocal(vw / vh, focal35);
  const scale = Math.max(ew / vw, eh / vh);
  const visW = ew / (vw * scale);
  const visH = eh / (vh * scale);
  const hfov = 2 * Math.atan(Math.tan((intrinsic.hfov * RAD) / 2) * visW) * DEG;
  const vfov = 2 * Math.atan(Math.tan((intrinsic.vfov * RAD) / 2) * visH) * DEG;
  return { hfov, vfov, focal35 };
}

export function focalFromTrack(track: MediaStreamTrack | null | undefined): number {
  const settings = track?.getSettings?.() as { zoom?: number } | undefined;
  const zoom = settings?.zoom && settings.zoom > 0 ? settings.zoom : 1;
  return Math.max(13, Math.min(80, DEFAULT_FOCAL_35 * zoom));
}

export type EnuDir = { e: number; n: number; u: number };

/** Unit direction in ENU from azimuth (from north, clockwise) and altitude. */
export function azAltToEnu(az: number, alt: number): EnuDir {
  const a = az * RAD;
  const el = alt * RAD;
  const c = Math.cos(el);
  return { e: Math.sin(a) * c, n: Math.cos(a) * c, u: Math.sin(el) };
}

export function enuToAzAlt(dir: EnuDir): { az: number; alt: number } {
  return {
    az: wrap360(Math.atan2(dir.e, dir.n) * DEG),
    alt: Math.atan2(dir.u, Math.hypot(dir.e, dir.n)) * DEG,
  };
}

type Basis = { right: EnuDir; up: EnuDir; forward: EnuDir };

/** Camera basis: heading from true north, pitch up, roll clockwise looking forward. */
export function cameraBasis(heading: number, pitch: number, roll: number): Basis {
  const h = heading * RAD;
  const p = pitch * RAD;
  const r = roll * RAD;
  const right0: EnuDir = { e: Math.cos(h), n: -Math.sin(h), u: 0 };
  const up0: EnuDir = {
    e: -Math.sin(h) * Math.sin(p),
    n: -Math.cos(h) * Math.sin(p),
    u: Math.cos(p),
  };
  const forward: EnuDir = {
    e: Math.sin(h) * Math.cos(p),
    n: Math.cos(h) * Math.cos(p),
    u: Math.sin(p),
  };
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  return {
    forward,
    right: {
      e: right0.e * cr + up0.e * sr,
      n: right0.n * cr + up0.n * sr,
      u: right0.u * cr + up0.u * sr,
    },
    up: {
      e: -right0.e * sr + up0.e * cr,
      n: -right0.n * sr + up0.n * cr,
      u: -right0.u * sr + up0.u * cr,
    },
  };
}

function dot(a: EnuDir, b: EnuDir) {
  return a.e * b.e + a.n * b.n + a.u * b.u;
}

export type ScreenPoint = { x: number; y: number; onScreen: boolean; depth: number };

/**
 * Pinhole projection of a world az/alt onto the camera image.
 * Uses a real camera matrix (heading / pitch / roll) instead of independent
 * small-angle az/alt offsets — accurate near zenith and at wide FOV.
 */
export function projectAzAlt(
  targetAz: number,
  targetAlt: number,
  heading: number,
  pitch: number,
  roll: number,
  width: number,
  height: number,
  hfov: number,
  vfov: number,
): ScreenPoint {
  const dir = azAltToEnu(targetAz, targetAlt);
  const cam = cameraBasis(heading, pitch, roll);
  const z = dot(dir, cam.forward);
  const x = dot(dir, cam.right);
  const y = dot(dir, cam.up);
  if (z <= 1e-4) {
    return { x: width * 0.5, y: height * 0.5, onScreen: false, depth: z };
  }
  const ndcX = x / z / Math.max(1e-6, Math.tan((hfov * RAD) / 2));
  const ndcY = y / z / Math.max(1e-6, Math.tan((vfov * RAD) / 2));
  return {
    x: width * (0.5 + ndcX * 0.5),
    y: height * (0.5 - ndcY * 0.5),
    onScreen: Math.abs(ndcX) < 1.35 && Math.abs(ndcY) < 1.35,
    depth: z,
  };
}

/** Inverse: a pixel → world azimuth / altitude. */
export function unprojectPixel(
  px: number,
  py: number,
  heading: number,
  pitch: number,
  roll: number,
  width: number,
  height: number,
  hfov: number,
  vfov: number,
): { az: number; alt: number } {
  const ndcX = (px / width - 0.5) * 2;
  const ndcY = (0.5 - py / height) * 2;
  const x = ndcX * Math.tan((hfov * RAD) / 2);
  const y = ndcY * Math.tan((vfov * RAD) / 2);
  const cam = cameraBasis(heading, pitch, roll);
  const dir: EnuDir = {
    e: x * cam.right.e + y * cam.up.e + cam.forward.e,
    n: x * cam.right.n + y * cam.up.n + cam.forward.n,
    u: x * cam.right.u + y * cam.up.u + cam.forward.u,
  };
  return enuToAzAlt(dir);
}

/** Heading offset that places `knownSunAz` on the pixel whose unprojected az is `tapAz`. */
export function sunLockOffset(tapAz: number, knownSunAz: number) {
  return wrapDelta(knownSunAz - tapAz);
}

export { wrap360 };
