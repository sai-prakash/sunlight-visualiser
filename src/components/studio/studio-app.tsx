import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, RotateCcw } from "lucide-react";
import { LazyCanvas } from "@/components/scene/lazy-canvas";
import { ArView } from "@/components/ar/ar-view";
import { Hud } from "./hud";
import { ToolDock } from "./tool-dock";
import { SunPathControl } from "./sun-path-control";
import { YearPanel } from "./year-panel";
import { LocationPanel } from "./location-panel";
import { Inspector } from "./inspector";
import { Button } from "@/components/ui/button";
import { useSolara } from "@/lib/store";

export function StudioApp() {
  const view = useSolara((s) => s.view);
  const resetSkyline = useSolara((s) => s.resetSkyline);
  const [locOpen, setLocOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-dvh bg-bg" />;
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        {view === "ar" ? <ArView /> : <LazyCanvas />}
      </div>

      <header className="pointer-events-none relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link to="/" className="pointer-events-auto font-display text-lg tracking-tight text-fg">
          Solara
        </Link>
        <div className="pointer-events-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setLocOpen((v) => !v)} aria-label="Location">
            <MapPin className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={resetSkyline} aria-label="Reset skyline">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>

      {view !== "year" && (
        <div className="relative z-10 px-4">
          <div className="max-w-lg rounded-xl bg-bg/55 p-3 backdrop-blur-sm">
            <Hud />
          </div>
        </div>
      )}

      {locOpen && (
        <div className="relative z-20 mx-4 mt-2 max-w-lg rounded-xl bg-surface p-4 shadow-lg">
          <LocationPanel onClose={() => setLocOpen(false)} />
        </div>
      )}

      {view === "year" && (
        <div className="relative z-10 mx-4 mt-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-bg/80 p-4 backdrop-blur-sm">
          <YearPanel />
        </div>
      )}

      <div className="pointer-events-none relative z-10 mt-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="pointer-events-auto mx-auto flex max-w-lg flex-col gap-2">
          {view === "site" && <Inspector />}
          {view !== "year" && (
            <div className="rounded-xl bg-bg/70 px-2 pb-2 pt-1 backdrop-blur-sm">
              <SunPathControl />
            </div>
          )}
          <div className="rounded-xl bg-bg/80 p-2 backdrop-blur-sm">
            <ToolDock />
          </div>
        </div>
      </div>
    </div>
  );
}
