import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function wrap360(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function wrapDelta(deg: number) {
  const w = wrap360(deg);
  return w > 180 ? w - 360 : w;
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatHours(h: number) {
  if (!Number.isFinite(h)) return "—";
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  if (hr <= 0) return `${min}m`;
  if (min === 0) return `${hr}h`;
  return `${hr}h ${min}m`;
}
