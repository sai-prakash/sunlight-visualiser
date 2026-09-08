import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSolara } from "@/lib/store";
import { fetchElevation, fetchTerrainRing, searchPlaces, type GeoHit } from "@/lib/geo/geocode";
import { fetchOsmBuildings } from "@/lib/geo/osm-buildings";
import { emptyHorizon, rasterizeTerrain } from "@/lib/solar/occlusion";
import { LocateFixed } from "lucide-react";

export function LocationPanel({ onClose }: { onClose?: () => void }) {
  const site = useSolara((s) => s.site);
  const setSite = useSolara((s) => s.setSite);
  const floorHeight = useSolara((s) => s.floorHeight);
  const setFloorHeight = useSolara((s) => s.setFloorHeight);
  const setUserHorizon = useSolara((s) => s.setUserHorizon);
  const resetDemo = useSolara((s) => s.resetDemo);
  const resetGeometry = useSolara((s) => s.resetGeometry);
  const replaceOsmBlockers = useSolara((s) => s.replaceOsmBlockers);
  const setView = useSolara((s) => s.setView);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const applyHit = async (hit: GeoHit) => {
    setBusy(true);
    setErr(null);
    try {
      const dLat = (hit.lat - site.lat) * 111320;
      const dLon = (hit.lon - site.lon) * 111320 * Math.cos((site.lat * Math.PI) / 180);
      const far = Math.hypot(dLat, dLon) > 90;
      if (far) resetGeometry();
      const elev = hit.elevation ?? (await fetchElevation(hit.lat, hit.lon)) ?? 0;
      setSite({
        lat: hit.lat,
        lon: hit.lon,
        elevation: elev,
        label: hit.label,
        timezone: hit.timezone,
      });
      const [ring, osm] = await Promise.all([
        fetchTerrainRing(hit.lat, hit.lon),
        fetchOsmBuildings(hit.lat, hit.lon).catch(() => []),
      ]);
      if (ring.length) {
        const h = emptyHorizon();
        rasterizeTerrain({ x: 0, y: floorHeight, z: 0 }, elev, ring, h);
        setUserHorizon(h);
      }
      if (osm.length) replaceOsmBlockers(osm);
      setView("map");
      onClose?.();
    } catch {
      setErr("Could not load elevation for that place.");
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setErr(null);
    try {
      setHits(await searchPlaces(q));
    } catch {
      setErr("Search failed. Try a city or neighbourhood name.");
    } finally {
      setBusy(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      setErr("Location is not available in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyHit({
          label: "Current location",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          elevation: pos.coords.altitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          country: "",
        });
      },
      () => {
        setBusy(false);
        setErr("Permission denied — search a place instead.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={q}
          placeholder="Search a neighbourhood"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <Button variant="subtle" onClick={() => void search()} disabled={busy}>
          Go
        </Button>
      </div>
      <Button variant="outline" onClick={useGps} disabled={busy}>
        <LocateFixed className="size-4" />
        Use my location
      </Button>
      {err ? <p className="text-sm text-blocked">{err}</p> : null}
      <ul className="flex flex-col gap-1">
        {hits.map((h) => (
          <li key={`${h.lat},${h.lon}`}>
            <button
              type="button"
              className="flex h-11 w-full items-center rounded-md px-3 text-left text-sm text-fg hover:bg-surface-2"
              onClick={() => void applyHit(h)}
            >
              {h.label}
            </button>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">Floor height above ground</span>
        <input
          type="range"
          min={0}
          max={80}
          step={0.5}
          value={floorHeight}
          onChange={(e) => setFloorHeight(Number(e.target.value))}
        />
        <span className="tabular-nums text-fg">{floorHeight.toFixed(1)} m</span>
      </label>
      <p className="text-xs text-muted">
        {site.lat.toFixed(5)}°N {site.lon.toFixed(5)}°E · mag. {site.magDeclination >= 0 ? "+" : ""}
        {site.magDeclination.toFixed(2)}° · WMM2025
      </p>
      <Button variant="ghost" onClick={resetDemo}>
        Restore sample plot
      </Button>
    </div>
  );
}
