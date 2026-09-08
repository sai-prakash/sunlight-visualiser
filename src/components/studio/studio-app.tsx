import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { LazyCanvas } from "@/components/scene/lazy-canvas";
import { ArView } from "@/components/ar/ar-view";
import { ToolDock, ViewSwitch } from "./tool-dock";
import { SunPathControl } from "./sun-path-control";
import { YearPanel } from "./year-panel";
import { LocationPanel } from "./location-panel";
import { Inspector } from "./inspector";
import { DayStrip } from "./day-strip";
import { Button } from "@/components/ui/button";
import { useSolara } from "@/lib/store";

const MapView = lazy(() => import("@/components/map/map-view").then((m) => ({ default: m.MapView })));

export function StudioApp() {
  const view = useSolara((s) => s.view);
  const playing = useSolara((s) => s.playing);
  const [locOpen, setLocOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [arChrome, setArChrome] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      useSolara.getState().tick(t - last);
      last = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  if (!mounted) {
    return <div className="h-dvh bg-bg" />;
  }

  const arClean = view === "ar" && !arChrome;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        {view === "ar" ? (
          <ArView chrome={arChrome} onToggleChrome={() => setArChrome((v) => !v)} />
        ) : view === "map" ? (
          <Suspense fallback={<div className="h-full bg-bg" />}>
            <MapView />
          </Suspense>
        ) : (
          <LazyCanvas />
        )}
      </div>

      <header className="pointer-events-none relative z-10 flex items-center justify-between gap-3 px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <Link
          to="/"
          className="pointer-events-auto font-display text-lg tracking-tight text-fg mix-blend-difference"
        >
          Solara
        </Link>
        {!arClean ? (
          <div className="pointer-events-auto">
            <ViewSwitch />
          </div>
        ) : (
          <span className="pointer-events-none text-[11px] uppercase tracking-[0.14em] text-fg/80">
            Tap for controls
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto size-10"
          onClick={() => setLocOpen((v) => !v)}
          aria-label="Location"
        >
          <MapPin className="size-4" />
        </Button>
      </header>

      {locOpen && (
        <div className="relative z-20 mx-3 mt-1 max-w-lg rounded-xl bg-surface p-4 shadow-lg">
          <LocationPanel onClose={() => setLocOpen(false)} />
        </div>
      )}

      {view === "year" && (
        <div className="relative z-10 mx-3 mt-1 min-h-0 flex-1 overflow-hidden rounded-xl bg-bg/85 p-4 backdrop-blur-sm">
          <YearPanel />
        </div>
      )}

      {!arClean && view !== "year" && (
        <div className="pointer-events-none relative z-10 mx-3 mt-1 max-w-lg">
          <div className="pointer-events-auto rounded-xl bg-bg/70 p-3 backdrop-blur-sm">
            <DayStrip />
          </div>
        </div>
      )}

      <div className="pointer-events-none relative z-10 mt-auto px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2">
        <div className="pointer-events-auto mx-auto flex max-w-lg flex-col gap-2">
          {!arClean && view !== "year" && <Inspector />}
          {!arClean && view !== "year" && (
            <div className="rounded-xl bg-bg/75 px-2 pb-2 pt-1 backdrop-blur-sm">
              <SunPathControl />
            </div>
          )}
          {!arClean && (
            <div className="rounded-xl bg-bg/80 p-2 backdrop-blur-sm">
              {view === "ar" ? <ViewSwitch /> : <ToolDock />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
