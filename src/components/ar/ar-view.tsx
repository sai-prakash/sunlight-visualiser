import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSolara } from "@/lib/store";
import { useSunNow } from "@/lib/solar/use-sun";
import { trueHeadingFromMagnetic } from "@/lib/geo/wmm";
import { wrapDelta } from "@/lib/utils";
import { Camera, ScanLine } from "lucide-react";

type Ori = { heading: number; pitch: number };

const FOV_H = 64;

export function ArView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sun = useSunNow();
  const site = useSolara((s) => s.site);
  const tool = useSolara((s) => s.tool);
  const setTool = useSolara((s) => s.setTool);
  const stampSkyline = useSolara((s) => s.stampSkyline);
  const userHorizon = useSolara((s) => s.userHorizon);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ori = useRef<Ori>({ heading: 0, pitch: 0 });
  const drawing = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    const start = async () => {
      try {
        const DOE = DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<string>;
        };
        if (typeof DOE.requestPermission === "function") {
          await DOE.requestPermission();
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!live || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch {
        if (live) setErr("Camera needs a phone, with permission, on HTTPS.");
      }
    };
    void start();

    const onOri = (e: DeviceOrientationEvent) => {
      const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const mag =
        typeof ev.webkitCompassHeading === "number"
          ? ev.webkitCompassHeading
          : ev.alpha != null
            ? (360 - ev.alpha) % 360
            : 0;
      ori.current.heading = trueHeadingFromMagnetic(mag, site.magDeclination);
      // beta: 0 flat, 90 upright looking at horizon
      ori.current.pitch = ev.beta != null ? 90 - ev.beta : 0;
    };
    window.addEventListener("deviceorientation", onOri, true);

    return () => {
      live = false;
      window.removeEventListener("deviceorientation", onOri, true);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [site.magDeclination]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas) {
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        if (canvas.width !== w * 2) {
          canvas.width = w * 2;
          canvas.height = h * 2;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(2, 0, 0, 2, 0, 0);
          ctx.clearRect(0, 0, w, h);
          const fovV = FOV_H * (h / w);
          const heading = ori.current.heading;
          const pitch = ori.current.pitch;

          // Skyline mask
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 4) {
            const ndcX = x / w - 0.5;
            const az = heading + ndcX * FOV_H;
            const i = ((Math.round(az) % 360) + 360) % 360;
            const alt = userHorizon[i] ?? -0.833;
            const ndcY = (alt - pitch) / fovV;
            const y = h * (0.5 - ndcY);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fillStyle = "rgba(212, 86, 74, 0.28)";
          ctx.fill();

          // Sun
          const dAz = wrapDelta(sun.pos.azimuth - heading);
          const dAlt = sun.pos.altitude - pitch;
          const sx = w * (0.5 + dAz / FOV_H);
          const sy = h * (0.5 - dAlt / fovV);
          const onScreen = sx > -40 && sx < w + 40 && sy > -40 && sy < h + 40 && sun.pos.altitude > -4;
          if (onScreen) {
            const blocked = sun.lit.fraction < 0.2;
            const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
            g.addColorStop(0, "rgba(255, 244, 208, 0.95)");
            g.addColorStop(0.2, blocked ? "rgba(212, 86, 74, 0.55)" : "rgba(232, 184, 74, 0.45)");
            g.addColorStop(1, "rgba(232, 184, 74, 0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(sx, sy, 90, 0, Math.PI * 2);
            ctx.fill();
            // rays toward bottom of frame (ground)
            ctx.strokeStyle = blocked ? "rgba(212, 86, 74, 0.35)" : "rgba(232, 184, 74, 0.35)";
            ctx.lineWidth = 2;
            for (let k = -3; k <= 3; k++) {
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx + k * 18, h);
              ctx.stroke();
            }
          }

          // Compass
          ctx.fillStyle = "rgba(11,11,12,0.45)";
          ctx.fillRect(w / 2 - 28, 10, 56, 22);
          ctx.fillStyle = "#f2f1ee";
          ctx.font = "600 11px Figtree, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${heading.toFixed(0)}°`, w / 2, 25);

          void video;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sun.pos.azimuth, sun.pos.altitude, sun.lit.fraction, userHorizon]);

  const onDraw = (clientX: number, clientY: number, target: HTMLCanvasElement) => {
    if (tool !== "skyline") return;
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const fovV = FOV_H * (h / w);
    const ndcX = x / w - 0.5;
    const ndcY = 0.5 - y / h;
    const az = ori.current.heading + ndcX * FOV_H;
    const alt = ori.current.pitch + ndcY * fovV;
    stampSkyline(az, alt);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
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
          drawing.current = true;
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <Camera className="size-8 text-muted" strokeWidth={1.5} />
          <div>
            <p className="font-display text-2xl">Live AR</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
              {err ?? "Open Solara on your phone, point at the terrace, and trace the towers that steal the light."}
            </p>
          </div>
          <Button variant="outline" onClick={() => setTool("skyline")}>
            <ScanLine className="size-4" />
            Trace skyline in 3D instead
          </Button>
        </div>
      )}
      {ready && (
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
          <p className="rounded-full bg-bg/70 px-3 py-1.5 text-[11px] text-fg backdrop-blur-sm">
            {tool === "skyline" ? "Draw along the rooftops" : "Sun overlaid on true north"}
          </p>
        </div>
      )}
    </div>
  );
}
