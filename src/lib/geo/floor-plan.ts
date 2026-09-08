import type { FloorPlan } from "../solar/types.ts";
import { destination } from "./enu.ts";

const RAD = Math.PI / 180;

/** Rotate a local (east, north) offset by plan yaw (clockwise from north). */
export function rotateEnu(
  localE: number,
  localN: number,
  rotDeg: number,
): { east: number; north: number } {
  const t = rotDeg * RAD;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    east: localE * c + localN * s,
    north: -localE * s + localN * c,
  };
}

export function floorPlanCorners(plan: FloorPlan): { east: number; north: number }[] {
  const hw = plan.widthM / 2;
  const hd = plan.depthM / 2;
  return [
    [-hw, hd],
    [hw, hd],
    [hw, -hd],
    [-hw, -hd],
  ].map(([e, n]) => {
    const r = rotateEnu(e as number, n as number, plan.rotation);
    return { east: plan.east + r.east, north: plan.north + r.north };
  });
}

export function floorPlanLatLngBounds(
  plan: FloorPlan,
  originLat: number,
  originLon: number,
): { lat: number; lon: number }[] {
  return floorPlanCorners(plan).map((c) => destination(originLat, originLon, c.east, c.north));
}

/** Scene pose: +X east, +Z south. */
export function floorPlanScene(plan: FloorPlan) {
  return {
    x: plan.east,
    y: 0.03,
    z: -plan.north,
    rot: (-plan.rotation * Math.PI) / 180,
  };
}

export function sizeFromAspect(
  pixelW: number,
  pixelH: number,
  longSideM: number,
): { widthM: number; depthM: number } {
  const a = Math.max(0.05, pixelW) / Math.max(0.05, pixelH);
  if (a >= 1) return { widthM: longSideM, depthM: longSideM / a };
  return { widthM: longSideM * a, depthM: longSideM };
}

export async function compressPlanImage(
  file: File,
  maxDim = 1600,
  quality = 0.72,
): Promise<{ src: string; pixelW: number; pixelH: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(2, Math.round(img.width * scale));
    const h = Math.max(2, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas");
    ctx.drawImage(img, 0, 0, w, h);
    return { src: canvas.toDataURL("image/jpeg", quality), pixelW: w, pixelH: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}
