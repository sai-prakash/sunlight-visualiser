export type GeoHit = {
  label: string;
  lat: number;
  lon: number;
  elevation: number | null;
  timezone: string;
  country: string;
};

export async function searchPlaces(query: string): Promise<GeoHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "6");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Place search failed");
  const data = (await res.json()) as {
    results?: {
      name: string;
      latitude: number;
      longitude: number;
      elevation?: number;
      timezone?: string;
      country?: string;
      admin1?: string;
    }[];
  };
  return (data.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
    elevation: r.elevation ?? null,
    timezone: r.timezone ?? "UTC",
    country: r.country ?? "",
  }));
}

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { elevation?: number[] };
  const e = data.elevation?.[0];
  return typeof e === "number" ? e : null;
}

export type TerrainRing = { az: number; dist: number; elevation: number };

/** Sample a coarse elevation ring around the site for distant terrain blockers. */
export async function fetchTerrainRing(
  lat: number,
  lon: number,
  dists = [120, 280, 550, 1100, 2200],
): Promise<TerrainRing[]> {
  const azimuths: number[] = [];
  for (let a = 0; a < 360; a += 15) azimuths.push(a);
  const lats: number[] = [];
  const lons: number[] = [];
  const meta: { az: number; dist: number }[] = [];
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180);

  for (const dist of dists) {
    for (const az of azimuths) {
      const r = (az * Math.PI) / 180;
      // az 0 = north
      const dLat = (Math.cos(r) * dist) / mPerDegLat;
      const dLon = (Math.sin(r) * dist) / mPerDegLon;
      lats.push(lat + dLat);
      lons.push(lon + dLon);
      meta.push({ az, dist });
    }
  }

  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", lats.join(","));
  url.searchParams.set("longitude", lons.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as { elevation?: number[] };
  const elev = data.elevation ?? [];
  const out: TerrainRing[] = [];
  for (let i = 0; i < meta.length; i++) {
    const e = elev[i];
    if (typeof e !== "number") continue;
    out.push({ az: meta[i]!.az, dist: meta[i]!.dist, elevation: e });
  }
  return out;
}
