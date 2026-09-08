import { useRef, type ReactNode } from "react";
import { useSolara } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressPlanImage, sizeFromAspect } from "@/lib/geo/floor-plan";
import { fetchOsmBuildings } from "@/lib/geo/osm-buildings";
import { fetchElevation, fetchTerrainRing } from "@/lib/geo/geocode";
import { emptyHorizon, rasterizeTerrain } from "@/lib/solar/occlusion";
import { Building2, Upload } from "lucide-react";
import { useState } from "react";

export function Inspector() {
  const selectedId = useSolara((s) => s.selectedId);
  const blockers = useSolara((s) => s.blockers);
  const spaces = useSolara((s) => s.spaces);
  const updateBlocker = useSolara((s) => s.updateBlocker);
  const updateSpace = useSolara((s) => s.updateSpace);
  const removeBlocker = useSolara((s) => s.removeBlocker);
  const removeSpace = useSolara((s) => s.removeSpace);
  const setSelected = useSolara((s) => s.setSelected);
  const tool = useSolara((s) => s.tool);
  const recording = useSolara((s) => s.recording);

  const blocker = blockers.find((b) => b.id === selectedId);
  const space = spaces.find((s) => s.id === selectedId);

  if (tool === "plan") {
    return <PlanInspector />;
  }
  if (tool === "space") {
    return <Hint>Drag a rectangle on the map or ground — terrace, balcony, or room. That is the space we score.</Hint>;
  }
  if (tool === "blocker") {
    return <Hint>Drag a footprint, then set height. Anything taller than the sun’s path turns the space red.</Hint>;
  }
  if (tool === "skyline") {
    return (
      <Hint>
        In AR, draw along the rooftops. The silhouette becomes the horizon the sun has to clear.
      </Hint>
    );
  }
  if (tool === "walk" || recording) {
    return <Hint>Walk the rooms with the camera on, or tap the floor in 3D. Finish to store the path.</Hint>;
  }

  if (blocker) {
    const storeys = Math.max(1, Math.round(blocker.height / 3));
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
        <Input
          value={blocker.name}
          onChange={(e) => updateBlocker(blocker.id, { name: e.target.value })}
        />
        <label className="text-sm text-muted">
          Height {blocker.height.toFixed(1)} m · {storeys} storey{storeys === 1 ? "" : "s"}
          <input
            className="mt-2 w-full"
            type="range"
            min={2}
            max={80}
            step={0.5}
            value={blocker.height}
            onChange={(e) => updateBlocker(blocker.id, { height: Number(e.target.value) })}
          />
        </label>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            removeBlocker(blocker.id);
            setSelected(null);
          }}
        >
          Remove
        </Button>
      </div>
    );
  }

  if (space) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
        <Input value={space.name} onChange={(e) => updateSpace(space.id, { name: e.target.value })} />
        <p className="text-xs tabular-nums text-muted">
          {space.width.toFixed(1)} × {space.depth.toFixed(1)} m at {space.elevation.toFixed(1)} m
        </p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            removeSpace(space.id);
            setSelected(null);
          }}
        >
          Remove
        </Button>
      </div>
    );
  }

  return null;
}

function PlanInspector() {
  const floorPlan = useSolara((s) => s.floorPlan);
  const setFloorPlan = useSolara((s) => s.setFloorPlan);
  const updateFloorPlan = useSolara((s) => s.updateFloorPlan);
  const site = useSolara((s) => s.site);
  const replaceOsmBlockers = useSolara((s) => s.replaceOsmBlockers);
  const setUserHorizon = useSolara((s) => s.setUserHorizon);
  const floorHeight = useSolara((s) => s.floorHeight);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Use a PNG or JPG of the floor plan.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { src, pixelW, pixelH } = await compressPlanImage(file);
      const size = sizeFromAspect(pixelW, pixelH, 22);
      setFloorPlan({
        src,
        pixelW,
        pixelH,
        east: 0,
        north: 0,
        widthM: size.widthM,
        depthM: size.depthM,
        rotation: 0,
        opacity: 0.82,
      });
    } catch {
      setMsg("Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const loadOsm = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const elev = (await fetchElevation(site.lat, site.lon)) ?? site.elevation;
      const [osm, ring] = await Promise.all([
        fetchOsmBuildings(site.lat, site.lon),
        fetchTerrainRing(site.lat, site.lon),
      ]);
      replaceOsmBlockers(osm);
      if (ring.length) {
        const h = emptyHorizon();
        rasterizeTerrain({ x: 0, y: floorHeight, z: 0 }, elev, ring, h);
        setUserHorizon(h);
      }
      setMsg(`${osm.length} nearby buildings loaded.`);
    } catch {
      setMsg("Could not reach OpenStreetMap. Draw blockers by hand.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button variant="subtle" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        <Upload className="size-3.5" />
        {floorPlan ? "Replace floor plan" : "Upload floor plan"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => void loadOsm()} disabled={busy}>
        <Building2 className="size-3.5" />
        Load nearby buildings
      </Button>
      {floorPlan ? (
        <>
          <label className="text-sm text-muted">
            Rotate {floorPlan.rotation.toFixed(0)}°
            <input
              className="mt-2 w-full"
              type="range"
              min={-180}
              max={180}
              step={1}
              value={floorPlan.rotation}
              onChange={(e) => updateFloorPlan({ rotation: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm text-muted">
            Width {floorPlan.widthM.toFixed(1)} m
            <input
              className="mt-2 w-full"
              type="range"
              min={6}
              max={80}
              step={0.5}
              value={floorPlan.widthM}
              onChange={(e) => {
                const widthM = Number(e.target.value);
                const ratio = floorPlan.pixelH / Math.max(1, floorPlan.pixelW);
                updateFloorPlan({ widthM, depthM: widthM * ratio });
              }}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setFloorPlan(null)}>
            Remove plan
          </Button>
          <p className="text-xs text-muted">Drag the plan on the map to sit it on the plot. North is up.</p>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          Drop a plan on the satellite, then draw the balcony. Nearby OSM buildings fill in what stands in front.
        </p>
      )}
      {msg ? <p className="text-xs text-muted">{msg}</p> : null}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface px-3 py-2.5 text-sm leading-relaxed text-muted">{children}</p>;
}
