import { wrap360 } from "../utils.ts";

const M_PER_DEG_LAT = 111_320;

export type Enu = { east: number; north: number; up: number };

export function metersPerDegLon(lat: number) {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Geodetic delta → local east/north/up metres. */
export function geodeticToEnu(
  lat: number,
  lon: number,
  alt: number,
  originLat: number,
  originLon: number,
  originAlt: number,
): Enu {
  const east = (lon - originLon) * metersPerDegLon(originLat);
  const north = (lat - originLat) * M_PER_DEG_LAT;
  return { east, north, up: alt - originAlt };
}

/** Scene frame: +X east, +Y up, +Z south. */
export function enuToScene(enu: Enu): { x: number; y: number; z: number } {
  return { x: enu.east, y: enu.up, z: -enu.north };
}

export function sceneToEnu(x: number, y: number, z: number): Enu {
  return { east: x, north: -z, up: y };
}

export function enuDistance(a: Enu, b: Enu = { east: 0, north: 0, up: 0 }) {
  return Math.hypot(a.east - b.east, a.north - b.north, a.up - b.up);
}

export function headingBetween(from: Enu, to: Enu) {
  return wrap360((Math.atan2(to.east - from.east, to.north - from.north) * 180) / Math.PI);
}

export function destination(lat: number, lon: number, east: number, north: number) {
  return {
    lat: lat + north / M_PER_DEG_LAT,
    lon: lon + east / metersPerDegLon(lat),
  };
}
