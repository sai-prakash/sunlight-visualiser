import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useSolara } from "@/lib/store";
import { destination, geodeticToEnu, sceneToEnu } from "@/lib/geo/enu";
import { solarPosition, sunDirection } from "@/lib/solar/spa";
import { occlude } from "@/lib/solar/occlusion";
import { useSiteHorizon, useSunNow } from "@/lib/solar/use-sun";
import { pickSpace } from "@/lib/solar/year";
import type { Site } from "@/lib/solar/types";
import { uid } from "@/lib/utils";

type LMod = typeof import("leaflet");

function sceneToLatLng(site: Site, x: number, z: number) {
  const enu = sceneToEnu(x, 0, z);
  return destination(site.lat, site.lon, enu.east, enu.north);
}

function latLngToScene(site: Site, lat: number, lon: number) {
  const enu = geodeticToEnu(lat, lon, 0, site.lat, site.lon, 0);
  return { x: enu.east, z: -enu.north };
}

function rectCorners(cx: number, cz: number, w: number, d: number, rot: number) {
  const hw = w / 2;
  const hd = d / 2;
  const r = (-rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, lz]) => ({
    x: cx + lx * c - lz * s,
    z: cz + lx * s + lz * c,
  }));
}

export function MapView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LMod | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<null | { a: { x: number; z: number }; b: { x: number; z: number } }>(null);
  const planDrag = useRef<null | { east: number; north: number; sx: number; sz: number }>(null);
  const [ready, setReady] = useState(false);

  const site = useSolara((s) => s.site);
  const sun = useSunNow();
  const horizon = useSiteHorizon();

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    let cancelled = false;
    const el = hostRef.current;

    (async () => {
      const leaflet = await import("leaflet");
      const L = (leaflet.default ?? leaflet) as unknown as LMod;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !el) return;
      LRef.current = L;

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        minZoom: 15,
        maxZoom: 20,
        zoomSnap: 0.25,
      }).setView([site.lat, site.lon], 18.2);

      const sitePane = map.createPane("site");
      sitePane.style.zIndex = "450";
      const labelsPane = map.createPane("labels");
      labelsPane.style.zIndex = "460";
      labelsPane.style.pointerEvents = "none";

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, attribution: "Tiles © Esri" },
      ).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
        pane: "labels",
        opacity: 0.9,
      }).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);

      const canvas = L.DomUtil.create("canvas", "solara-map-overlay") as HTMLCanvasElement;
      canvas.style.pointerEvents = "auto";
      sitePane.appendChild(canvas);
      canvasRef.current = canvas;
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      canvasRef.current = null;
    };
    // site is applied via flyTo below — init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const cur = map.getCenter();
    const dLat = Math.abs(cur.lat - site.lat);
    const dLon = Math.abs(cur.lng - site.lon);
    if (dLat > 0.00025 || dLon > 0.00025) {
      map.flyTo([site.lat, site.lon], Math.max(map.getZoom(), 18), { duration: 0.7 });
    }
  }, [site.lat, site.lon, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !ready) return;

    const redraw = () => {
      const L = LRef.current;
      if (!L) return;
      const store = useSolara.getState();
      const size = map.getSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size.x * dpr);
      canvas.height = Math.round(size.y * dpr);
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      const topLeft = map.containerPointToLayerPoint(L.point(0, 0));
      L.DomUtil.setPosition(canvas, topLeft);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const toXY = (x: number, z: number) => {
        const ll = sceneToLatLng(store.site, x, z);
        const p = map.latLngToContainerPoint([ll.lat, ll.lon]);
        return { x: p.x, y: p.y };
      };

      const plan = store.floorPlan;
      if (plan) {
        if (!imgRef.current || imgRef.current.src !== plan.src) {
          const img = new Image();
          img.onload = () => redraw();
          img.src = plan.src;
          imgRef.current = img;
        }
        const img = imgRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
          const c = toXY(plan.east, -plan.north);
          const e1 = toXY(plan.east + 1, -plan.north);
          const s1 = toXY(plan.east, -plan.north + 1);
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.transform(e1.x - c.x, e1.y - c.y, s1.x - c.x, s1.y - c.y, 0, 0);
          ctx.rotate((plan.rotation * Math.PI) / 180);
          ctx.globalAlpha = plan.opacity;
          ctx.drawImage(img, -plan.widthM / 2, -plan.depthM / 2, plan.widthM, plan.depthM);
          ctx.restore();
        }
      }

      const drawPoly = (
        pts: { x: number; z: number }[],
        fill: string,
        stroke: string,
        width = 1.4,
      ) => {
        if (pts.length < 2) return;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const xy = toXY(p.x, p.z);
          if (i === 0) ctx.moveTo(xy.x, xy.y);
          else ctx.lineTo(xy.x, xy.y);
        });
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      for (const b of store.blockers) {
        const selected = store.selectedId === b.id;
        const corners = rectCorners(b.cx, b.cz, b.width, b.depth, b.rotation);
        drawPoly(
          corners,
          selected ? "rgba(212,86,74,0.38)" : "rgba(212,86,74,0.22)",
          selected ? "rgba(242,241,238,0.9)" : "rgba(212,86,74,0.7)",
          selected ? 2 : 1,
        );
        const label = toXY(b.cx, b.cz);
        ctx.fillStyle = "rgba(242,241,238,0.9)";
        ctx.font = "600 10px Figtree, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(b.height)} m`, label.x, label.y + 3);
      }

      for (const s of store.spaces) {
        const selected = store.selectedId === s.id || (!store.selectedId && s === store.spaces[0]);
        const corners = rectCorners(s.cx, s.cz, s.width, s.depth, s.rotation);
        drawPoly(
          corners,
          selected ? "rgba(232,184,74,0.42)" : "rgba(232,184,74,0.22)",
          selected ? "#f2f1ee" : "rgba(232,184,74,0.85)",
          selected ? 2.2 : 1.4,
        );
        const label = toXY(s.cx, s.cz);
        ctx.fillStyle = "#f2f1ee";
        ctx.font = "600 11px Figtree, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.name, label.x, label.y - 6);
      }

      const ghost = dragRef.current;
      if (ghost) {
        const w = Math.abs(ghost.b.x - ghost.a.x);
        const d = Math.abs(ghost.b.z - ghost.a.z);
        const cx = (ghost.a.x + ghost.b.x) / 2;
        const cz = (ghost.a.z + ghost.b.z) / 2;
        const color = store.tool === "blocker" ? "rgba(212,86,74,0.35)" : "rgba(232,184,74,0.35)";
        drawPoly(rectCorners(cx, cz, w, d, 0), color, "#f2f1ee", 1.2);
      }

      const origin = toXY(0, 0);
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#f2f1ee";
      ctx.fill();
      const n = toXY(0, -8);
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = "rgba(242,241,238,0.7)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#f2f1ee";
      ctx.font = "600 11px Figtree, sans-serif";
      ctx.fillText("N", n.x, n.y - 6);

      const space = pickSpace(store.spaces, store.selectedId);
      const date = new Date(store.now);
      const pos = solarPosition(date, store.site.lat, store.site.lon, store.site.elevation);
      if (space && pos.altitude > -0.5) {
        const dir = sunDirection(pos.azimuth, pos.altitude);
        const hit = occlude(
          { x: space.cx, y: space.elevation + 0.05, z: space.cz },
          { x: dir[0], y: dir[1], z: dir[2] },
          pos.azimuth,
          pos.altitude,
          store.blockers,
          horizon,
        );
        const len = 42;
        const az = (pos.azimuth * Math.PI) / 180;
        const endX = space.cx + Math.sin(az) * len;
        const endZ = space.cz - Math.cos(az) * len;
        const a = toXY(space.cx, space.cz);
        const b = toXY(endX, endZ);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = hit.blocked ? "rgba(212,86,74,0.9)" : "rgba(232,184,74,0.95)";
        ctx.lineWidth = 2.4;
        ctx.stroke();

        const fan = 7;
        for (let k = -fan; k <= fan; k++) {
          const t = k / fan;
          const spread = 9 * t;
          const r = (pos.azimuth + spread) * (Math.PI / 180);
          const fx = space.cx + Math.sin(r) * (28 - Math.abs(k));
          const fz = space.cz - Math.cos(r) * (28 - Math.abs(k));
          const p = toXY(fx, fz);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = hit.blocked
            ? `rgba(212,86,74,${0.08 + 0.08 * (1 - Math.abs(t))})`
            : `rgba(232,184,74,${0.1 + 0.12 * (1 - Math.abs(t))})`;
          ctx.lineWidth = 6;
          ctx.stroke();
        }
      }

      void sun;
    };

    const onMove = () => redraw();
    map.on("move zoom viewreset resize", onMove);
    const unsub = useSolara.subscribe(() => redraw());
    redraw();

    return () => {
      map.off("move zoom viewreset resize", onMove);
      unsub();
    };
  }, [ready, horizon, sun.pos.azimuth, sun.pos.altitude]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !ready) return;

    const eventLatLng = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const L = LRef.current;
      if (!L) return null;
      const pt = L.point(e.clientX - rect.left, e.clientY - rect.top);
      return map.containerPointToLatLng(pt);
    };

    const hitSpaceOrBlocker = (x: number, z: number) => {
      const store = useSolara.getState();
      const inside = (
        cx: number,
        cz: number,
        w: number,
        d: number,
        rot: number,
        px: number,
        pz: number,
      ) => {
        const r = (rot * Math.PI) / 180;
        const dx = px - cx;
        const dz = pz - cz;
        const lx = dx * Math.cos(r) + dz * Math.sin(r);
        const lz = -dx * Math.sin(r) + dz * Math.cos(r);
        return Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2;
      };
      for (const s of [...store.spaces].reverse()) {
        if (inside(s.cx, s.cz, s.width, s.depth, s.rotation, x, z)) return { kind: "space" as const, id: s.id };
      }
      for (const b of [...store.blockers].reverse()) {
        if (inside(b.cx, b.cz, b.width, b.depth, b.rotation, x, z))
          return { kind: "blocker" as const, id: b.id };
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      const ll = eventLatLng(e);
      if (!ll) return;
      const store = useSolara.getState();
      const scene = latLngToScene(store.site, ll.lat, ll.lng);
      const tool = store.tool;

      if (tool === "plan" && store.floorPlan) {
        planDrag.current = {
          east: store.floorPlan.east,
          north: store.floorPlan.north,
          sx: scene.x,
          sz: scene.z,
        };
        map.dragging.disable();
        return;
      }
      if (tool === "space" || tool === "blocker") {
        dragRef.current = { a: scene, b: scene };
        map.dragging.disable();
        return;
      }
    };

    const onMove = (e: PointerEvent) => {
      const ll = eventLatLng(e);
      if (!ll) return;
      const store = useSolara.getState();
      const scene = latLngToScene(store.site, ll.lat, ll.lng);
      if (planDrag.current && store.floorPlan) {
        const de = scene.x - planDrag.current.sx;
        const dn = -(scene.z - planDrag.current.sz);
        store.updateFloorPlan({
          east: planDrag.current.east + de,
          north: planDrag.current.north + dn,
        });
        return;
      }
      if (dragRef.current) {
        dragRef.current = { ...dragRef.current, b: scene };
      }
    };

    const onUp = (e: PointerEvent) => {
      map.dragging.enable();
      const store = useSolara.getState();
      if (planDrag.current) {
        planDrag.current = null;
        return;
      }
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      const ll = eventLatLng(e);
      const b = ll ? latLngToScene(store.site, ll.lat, ll.lng) : drag.b;
      const w = Math.abs(b.x - drag.a.x);
      const d = Math.abs(b.z - drag.a.z);
      if (w < 1.2 || d < 1.2) return;
      const cx = (drag.a.x + b.x) / 2;
      const cz = (drag.a.z + b.z) / 2;
      if (store.tool === "space") {
        store.addSpace({
          name: store.spaces.length ? `Space ${store.spaces.length + 1}` : "Balcony",
          cx,
          cz,
          width: w,
          depth: d,
          rotation: 0,
          elevation: store.floorHeight,
        });
      } else if (store.tool === "blocker") {
        store.addBlocker({
          id: uid("blk"),
          name: "Building",
          kind: "building",
          cx,
          cz,
          width: w,
          depth: d,
          height: 18,
          rotation: 0,
          baseElevation: 0,
          source: "user",
        });
      }
    };

    const onClick = (e: { latlng: { lat: number; lng: number } }) => {
      const store = useSolara.getState();
      if (store.tool !== "orbit") return;
      const scene = latLngToScene(store.site, e.latlng.lat, e.latlng.lng);
      const hit = hitSpaceOrBlocker(scene.x, scene.z);
      if (hit) store.setSelected(hit.id);
    };
    map.on("click", onClick);

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      map.off("click", onClick);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      map.dragging.enable();
    };
  }, [ready]);

  const tool = useSolara((s) => s.tool);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.pointerEvents = tool === "space" || tool === "blocker" || tool === "plan" ? "auto" : "none";
  }, [tool, ready]);

  return <div ref={hostRef} className="absolute inset-0 bg-bg" data-map-root />;
}
