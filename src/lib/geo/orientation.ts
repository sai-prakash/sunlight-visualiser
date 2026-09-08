import { Euler, Quaternion, Vector3 } from "three";
import { wrap360, wrapDelta } from "../utils.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const zee = new Vector3(0, 0, 1);
const euler = new Euler();
const q0 = new Quaternion();
const q1 = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const lookTmp = new Vector3();
const upTmp = new Vector3();
const rightTmp = new Vector3();
const worldUp = new Vector3(0, 1, 0);

export type CameraAttitude = {
  heading: number;
  pitch: number;
  roll: number;
  look: { x: number; y: number; z: number };
};

/**
 * Rear-camera look from W3C DeviceOrientation (α, β, γ) + screen angle.
 * Three.js DeviceOrientationControls convention: Y-up, −Z north when α=0, β=90.
 */
export function attitudeFromEuler(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
): CameraAttitude {
  euler.set(beta * RAD, alpha * RAD, -gamma * RAD, "YXZ");
  const q = new Quaternion().setFromEuler(euler);
  q.multiply(q1);
  q.multiply(q0.setFromAxisAngle(zee, -screenAngle * RAD));

  lookTmp.set(0, 0, -1).applyQuaternion(q);
  upTmp.set(0, 1, 0).applyQuaternion(q);

  const lx = lookTmp.x;
  const ly = lookTmp.y;
  const lz = lookTmp.z;
  const horiz = Math.hypot(lx, lz);
  const pitch = Math.atan2(ly, Math.max(horiz, 1e-8)) * DEG;
  const heading = wrap360(Math.atan2(lx, -lz) * DEG);

  rightTmp.copy(lookTmp).cross(worldUp);
  if (rightTmp.lengthSq() < 1e-8) {
    return { heading, pitch, roll: 0, look: { x: lx, y: ly, z: lz } };
  }
  rightTmp.normalize();
  const trueUpX = rightTmp.y * lz - rightTmp.z * ly;
  const trueUpY = rightTmp.z * lx - rightTmp.x * lz;
  const trueUpZ = rightTmp.x * ly - rightTmp.y * lx;
  const roll =
    Math.atan2(
      upTmp.x * rightTmp.x + upTmp.y * rightTmp.y + upTmp.z * rightTmp.z,
      upTmp.x * trueUpX + upTmp.y * trueUpY + upTmp.z * trueUpZ,
    ) * DEG;

  return { heading, pitch, roll, look: { x: lx, y: ly, z: lz } };
}

export function screenOrientationDeg(): number {
  const so = (typeof screen !== "undefined" ? screen.orientation : undefined) as
    | { angle?: number }
    | undefined;
  if (typeof so?.angle === "number") return so.angle;
  if (typeof window !== "undefined" && typeof window.orientation === "number") {
    return window.orientation;
  }
  return 0;
}

/** 1€ filter — low lag while still, smooth while moving. Circular-safe for headings. */
export class OneEuro {
  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private primed = false;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  reset() {
    this.primed = false;
  }

  filter(value: number, timeMs: number, circular = false): number {
    if (!this.primed) {
      this.primed = true;
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = timeMs;
      return value;
    }
    const dt = Math.max(0.001, (timeMs - this.tPrev) / 1000);
    this.tPrev = timeMs;
    let x = value;
    if (circular) x = this.xPrev + wrapDelta(value - this.xPrev);
    const dx = (x - this.xPrev) / dt;
    const edx = this.smooth(this.dxPrev, dx, this.alpha(dt, this.dCutoff));
    this.dxPrev = edx;
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xf = this.smooth(this.xPrev, x, this.alpha(dt, cutoff));
    this.xPrev = xf;
    return circular ? wrap360(xf) : xf;
  }

  private alpha(dt: number, cutoff: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  private smooth(prev: number, next: number, a: number) {
    return a * next + (1 - a) * prev;
  }
}
