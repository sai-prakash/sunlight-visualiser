import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSolara } from "@/lib/store";
import { useSunNow } from "@/lib/solar/use-sun";
import { wrap360 } from "@/lib/utils";
import { PoseTracker, type LivePose, EMPTY_POSE } from "@/lib/ar/pose-tracker";
import { displayedFov, focalFromTrack, projectAzAlt, sunLockOffset, unprojectPixel } from "@/lib/ar/project";
import { probeXr, startXrSession, xrLocalToSite, type XrCapability, type XrSessionHandle } from "@/lib/ar/xr-world";
import { enuToScene } from "@/lib/geo/enu";
import { solarPosition } from "@/lib/solar/spa";
import { occlude } from "@/lib/solar/occlusion";
import { Camera } from "lucide-react";

export function ArView({
  chrome,
  onToggleChrome,
}: {
  chrome?: boolean;
  onToggleChrome?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<PoseTracker | null>(null);
  const poseRef = useRef<LivePose>({ ...EMPTY_POSE });
  const xrRef = useRef<XrSessionHandle | null>(null);
  const yaw0 = useRef(0);

  const sun = useSunNow();
  const site = useSolara((s) => s.site);
  const tool = useSolara((s) => s.tool);
  const stampSkyline = useSolara((s) => s.stampSkyline);
  const userHorizon = useSolara((s) => s.userHorizon);
  const headingOffset = useSolara((s) => s.headingOffset);
  const headingLocked = useSolara((s) => s.headingLocked);
  const addHeadingOffset = useSolara((s) => s.addHeadingOffset);
  const resetHeadingOffset = useSolara((s) => s.resetHeadingOffset);
  const setLivePose = useSolara((s) => s.setLivePose);
  const recording = useSolara((s) => s.recording);
  const addWalkPoint = useSolara((s) => s.addWalkPoint);
  const floorHeight = useSolara((s) => s.floorHeight);
  const blockers = useSolara((s) => s.blockers);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [xrCap, setXrCap] = useState<XrCapability | null>(null);
  const [xrOn, setXrOn] = useState(false);
  const [mode, setMode] = useState<"view" | "sunlock" | "north">("view");
  const drawing = useRef(false);
  const lastWalk = useRef(0);

  useEffect(() => {
    void probeXr().then(setXrCap);
  }, []);

  useEffect(() => {
    const t = trackerRef.current;
    if (!t) return;
    t.configure({
      declination: site.magDeclination,
      headingOffset,
      origin: { lat: site.lat, lon: site.lon, alt: site.elevation },
    });
  }, [site.lat, site.lon, site.elevation, site.magDeclination, headingOffset]);

  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const loop = () => {
      const tracker = trackerRef.current;
      const xr = xrRef.current;
      if (tracker) {
        if (xr) {
          const sample = xr.read();
          if (sample) {
            const sitePose = xrLocalToSite(sample, yaw0.current);
            tracker.applyXr({
              heading: sitePose.heading,
              pitch: sample.pitch,
              roll: sample.roll,
              east: sitePose.east,
              north: sitePose.north,
              up: sample.y,
              hitDistance: sample.hit?.distance ?? null,
              hasLidar: sample.hasLidar,
              hasDepth: sample.hasDepth,
              source: sample.hasLidar ? "lidar" : "world",
            });
          }
        }
        poseRef.current = tracker.pose;
        if (tracker.pose.frame % 4 === 0) setLivePose(tracker.pose);
        if (recording) {
          const p = tracker.pose;
          const now = performance.now();
          if (p.gpsActive && now - lastWalk.current > 450) {
            lastWalk.current = now;
            const s = enuToScene({ east: p.east, north: p.north, up: 0 });
            addWalkPoint({ x: s.x, y: floorHeight + 1.45, z: s.z, t: Date.now() });
          }
        }
      }
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    ready,
    sun.pos.azimuth,
    sun.pos.altitude,
    sun.lit.fraction,
    userHorizon,
    recording,
    floorHeight,
    addWalkPoint,
    setLivePose,
    tool,
    blockers,
  ]);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w * 2) {
      canvas.width = w * 2;
      canvas.height = h * 2;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pose = poseRef.current;
    const heading = pose.heading;
    const pitch = pose.pitch;
    const roll = pose.roll;
    const track = video?.srcObject instanceof MediaStream ? video.srcObject.getVideoTracks()[0] : undefined;
    const focal = focalFromTrack(track);
    const fov = displayedFov(video?.videoWidth || 1920, video?.videoHeight || 1080, w, h, focal);

    if (tool === "skyline") {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const ray = unprojectPixel(x, h * 0.5, heading, pitch, roll, w, h, fov.hfov, fov.vfov);
        const i = ((Math.round(wrap360(ray.az)) % 360) + 360) % 360;
        const alt = userHorizon[i] ?? -0.833;
        const p = projectAzAlt(ray.az, alt, heading, pitch, roll, w, h, fov.hfov, fov.vfov);
        ctx.lineTo(x, p.y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(212, 86, 74, 0.28)";
      ctx.fill();
    }

    const store = useSolara.getState();
    const path: { x: number; y: number; lit: boolean }[] = [];
    const rise = sun.times.sunrise.getTime();
    const setT = sun.times.sunset.getTime();
    const origin = sun.space
      ? { x: sun.space.cx, y: sun.space.elevation + 0.05, z: sun.space.cz }
      : { x: 0, y: floorHeight, z: 0 };
    for (let t = rise; t <= setT; t += 8 * 60_000) {
      const pos = solarPosition(new Date(t), site.lat, site.lon, site.elevation);
      if (pos.altitude < -1) continue;
      const p = projectAzAlt(pos.azimuth, pos.altitude, heading, pitch, roll, w, h, fov.hfov, fov.vfov);
      if (!p.onScreen && (p.x < -40 || p.x > w + 40)) continue;
      const dir = {
        x: Math.sin((pos.azimuth * Math.PI) / 180) * Math.cos((pos.altitude * Math.PI) / 180),
        y: Math.sin((pos.altitude * Math.PI) / 180),
        z: -Math.cos((pos.azimuth * Math.PI) / 180) * Math.cos((pos.altitude * Math.PI) / 180),
      };
      const hit = occlude(origin, dir, pos.azimuth, pos.altitude, store.blockers, sun.horizon);
      path.push({ x: p.x, y: p.y, lit: !hit.blocked });
    }
    if (path.length > 1) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = a.lit ? "rgba(232,184,74,0.85)" : "rgba(212,86,74,0.7)";
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }

    const sunP = projectAzAlt(sun.pos.azimuth, sun.pos.altitude, heading, pitch, roll, w, h, fov.hfov, fov.vfov);
    const sunOn = sunP.onScreen && sun.pos.altitude > -4;
    if (sunOn) {
      const blocked = sun.lit.fraction < 0.2;
      const g = ctx.createRadialGradient(sunP.x, sunP.y, 3, sunP.x, sunP.y, 70);
      g.addColorStop(0, "rgba(255, 244, 208, 0.95)");
      g.addColorStop(0.22, blocked ? "rgba(212, 86, 74, 0.5)" : "rgba(232, 184, 74, 0.42)");
      g.addColorStop(1, "rgba(232, 184, 74, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, 70, 0, Math.PI * 2);
      ctx.fill();

      const ground = projectAzAlt(
        sun.pos.azimuth,
        Math.max(-2, sun.pos.altitude - 28),
        heading,
        pitch,
        roll,
        w,
        h,
        fov.hfov,
        fov.vfov,
      );
      for (let k = -4; k <= 4; k++) {
        const ox = k * 14;
        ctx.beginPath();
        ctx.moveTo(sunP.x + ox * 0.15, sunP.y);
        ctx.lineTo(ground.x + ox, Math.min(h, ground.y + 40));
        ctx.strokeStyle = blocked ? `rgba(212,86,74,${0.1 + 0.08 * (1 - Math.abs(k) / 4)})` : `rgba(232,184,74,${0.12 + 0.1 * (1 - Math.abs(k) / 4)})`;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
    }

    if (tool === "skyline" || mode !== "view") {
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = "rgba(242,241,238,0.85)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx - 3, cy);
      ctx.moveTo(cx + 3, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy - 3);
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(11,11,12,0.55)";
    const pill = sun.space
      ? `${Math.round(sun.lit.fraction * 100)}% lit · ${sun.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : sun.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ctx.font = "600 12px Figtree, sans-serif";
    const tw = ctx.measureText(pill).width;
    const px = 12;
    const py = 12;
    ctx.beginPath();
    roundRect(ctx, px, py, tw + 20, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#f2f1ee";
    ctx.textAlign = "left";
    ctx.fillText(pill, px + 10, py + 18);
  };

  const currentFov = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const w = canvas?.clientWidth || 1;
    const h = canvas?.clientHeight || 1;
    const track = video?.srcObject instanceof MediaStream ? video.srcObject.getVideoTracks()[0] : undefined;
    return { w, h, fov: displayedFov(video?.videoWidth || 1920, video?.videoHeight || 1080, w, h, focalFromTrack(track)) };
  };

  const onDraw = (clientX: number, clientY: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pose = poseRef.current;
    const { w, h, fov } = currentFov();
    const ray = unprojectPixel(x, y, pose.heading, pose.pitch, pose.roll, w, h, fov.hfov, fov.vfov);
    if (mode === "sunlock") {
      addHeadingOffset(sunLockOffset(ray.az, sun.pos.azimuth));
      setMode("view");
      return;
    }
    if (mode === "north") {
      addHeadingOffset(-pose.heading);
      setMode("view");
      return;
    }
    if (tool === "skyline") {
      stampSkyline(ray.az, ray.alt);
      return;
    }
    onToggleChrome?.();
  };

  const startSensors = async (wantXr: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const tracker = new PoseTracker();
      tracker.configure({
        declination: site.magDeclination,
        headingOffset: useSolara.getState().headingOffset,
        origin: { lat: site.lat, lon: site.lon, alt: site.elevation },
      });
      await tracker.requestPermissions();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      tracker.start();
      trackerRef.current = tracker;
      useSolara.getState().setNow(Date.now());
      setReady(true);

      if (wantXr && overlayRef.current) {
        const handle = await startXrSession(overlayRef.current);
        if (handle) {
          xrRef.current = handle;
          yaw0.current = tracker.pose.heading;
          setXrOn(true);
        } else {
          setErr("World tracking is not available in this browser. Compass + sun-lock is on.");
        }
      }
    } catch {
      setErr("Camera and motion need a phone, with permission, on HTTPS.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
      void xrRef.current?.end();
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div ref={overlayRef} className="relative h-full w-full overflow-hidden bg-bg">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          drawing.current = mode === "view" && tool === "skyline";
          onDraw(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          onDraw(e.clientX, e.clientY, e.currentTarget);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />

      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg px-6 pb-36 pt-20 text-center">
          <Camera className="size-8 text-muted" strokeWidth={1.5} />
          <div>
            <p className="font-display text-2xl">Live camera</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {err ??
                "The sun path and rays overlay the real sky. Lock heading to the sun if the compass drifts."}
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button onClick={() => void startSensors(false)} disabled={busy}>
              Enable camera
            </Button>
            {xrCap?.ar ? (
              <Button variant="outline" onClick={() => void startSensors(true)} disabled={busy}>
                Use LiDAR / world tracking
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {ready && chrome ? (
        <div className="pointer-events-none absolute bottom-24 left-0 right-0 flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-bg/70 p-1.5 backdrop-blur-sm">
            <Button
              size="sm"
              variant={mode === "sunlock" ? "primary" : "ghost"}
              onClick={(e) => {
                e.stopPropagation();
                setMode((m) => (m === "sunlock" ? "view" : "sunlock"));
              }}
              disabled={sun.pos.altitude < -2}
            >
              Lock to sun
            </Button>
            <Button
              size="sm"
              variant={mode === "north" ? "primary" : "ghost"}
              onClick={(e) => {
                e.stopPropagation();
                setMode((m) => (m === "north" ? "view" : "north"));
              }}
            >
              This is north
            </Button>
            {headingLocked ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  resetHeadingOffset();
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {ready && xrOn ? null : null}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
