import { uid } from "../utils.ts";
import type { Blocker } from "../solar/types.ts";
import { geodeticToEnu } from "./enu.ts";

type OsmNode = { type: "node"; id: number; lat: number; lon: number };
type OsmWay = {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};
type OsmEl = OsmNode | OsmWay | { type: string; id: number };

export type OsmResponse = { elements?: OsmEl[] };

const OVERPASS = [
  "https://overpass-api.io/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function parseHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return 12;
  const raw = tags.height ?? tags["building:height"];
  if (raw) {
    const m = parseFloat(raw.replace(/m$/i, "").trim());
    if (Number.isFinite(m) && m > 1.5 && m < 450) return m;
  }
  const levels = parseFloat(tags["building:levels"] ?? tags.levels ?? "");
  if (Number.isFinite(levels) && levels > 0 && levels < 120) return levels * 3.1;
  return 12;
}

export function buildingsFromOsm(
  data: OsmResponse,
  originLat: number,
  originLon: number,
  radiusM = 180,
): Blocker[] {
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const el of data.elements ?? []) {
    if (el.type === "node" && "lat" in el) nodes.set(el.id, { lat: el.lat, lon: el.lon });
  }
  const out: Blocker[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || !("nodes" in el)) continue;
    const tags = el.tags ?? {};
    if (!tags.building || tags.building === "no") continue;
    const pts: { e: number; n: number }[] = [];
    for (const id of el.nodes) {
      const n = nodes.get(id);
      if (!n) continue;
      const enu = geodeticToEnu(n.lat, n.lon, 0, originLat, originLon, 0);
      pts.push({ e: enu.east, n: enu.north });
    }
    if (pts.length < 3) continue;
    let minE = Infinity,
      maxE = -Infinity,
      minN = Infinity,
      maxN = -Infinity;
    for (const p of pts) {
      if (p.e < minE) minE = p.e;
      if (p.e > maxE) maxE = p.e;
      if (p.n < minN) minN = p.n;
      if (p.n > maxN) maxN = p.n;
    }
    const east = (minE + maxE) / 2;
    const north = (minN + maxN) / 2;
    if (Math.hypot(east, north) > radiusM) continue;
    const width = Math.max(3.2, maxE - minE);
    const depth = Math.max(3.2, maxN - minN);
    if (width > 140 || depth > 140) continue;
    const name =
      tags.name ||
      tags["addr:housename"] ||
      tags["addr:housenumber"] ||
      `Building ${el.id.toString().slice(-4)}`;
    out.push({
      id: uid("osm"),
      name,
      kind: "building",
      cx: east,
      cz: -north,
      width,
      depth,
      height: parseHeight(tags),
      rotation: 0,
      baseElevation: 0,
      source: "osm",
      osmId: String(el.id),
    });
  }
  return out;
}

export async function fetchOsmBuildings(
  lat: number,
  lon: number,
  radiusM = 160,
): Promise<Blocker[]> {
  const query = `[out:json][timeout:18];(way["building"](around:${Math.round(radiusM)},${lat},${lon}););out body;>;out skel qt;`;
  let lastErr: unknown = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = (await res.json()) as OsmResponse;
      return buildingsFromOsm(data, lat, lon, radiusM + 20);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Could not load nearby buildings");
}
