import { BoxSelect, Building2, Compass, Footprints, Move, ScanLine } from "lucide-react";
import { useSolara, type StudioView, type Tool } from "@/lib/store";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; label: string; icon: typeof Move }[] = [
  { id: "orbit", label: "Look", icon: Move },
  { id: "space", label: "Space", icon: BoxSelect },
  { id: "blocker", label: "Blocker", icon: Building2 },
  { id: "skyline", label: "Skyline", icon: ScanLine },
  { id: "walk", label: "Walk", icon: Footprints },
];

const VIEWS: { id: StudioView; label: string }[] = [
  { id: "site", label: "Site" },
  { id: "year", label: "Year" },
  { id: "ar", label: "Live AR" },
];

export function ToolDock() {
  const tool = useSolara((s) => s.tool);
  const setTool = useSolara((s) => s.setTool);
  const view = useSolara((s) => s.view);
  const setView = useSolara((s) => s.setView);
  const recording = useSolara((s) => s.recording);
  const startWalk = useSolara((s) => s.startWalk);
  const finishWalk = useSolara((s) => s.finishWalk);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex rounded-lg bg-surface p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              "h-10 flex-1 rounded-md text-sm font-medium transition-colors duration-(--motion-quick)",
              view === v.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "site" && (
        <div className="flex items-center gap-1 overflow-x-auto">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === "walk") {
                    if (recording) finishWalk();
                    else startWalk();
                    return;
                  }
                  setTool(t.id);
                }}
                className={cn(
                  "flex h-11 min-w-11 flex-col items-center justify-center rounded-md px-2.5 text-[10px] transition-colors duration-(--motion-quick)",
                  active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="mb-0.5 size-4" strokeWidth={1.75} />
                {t.id === "walk" && recording ? "Finish" : t.label}
              </button>
            );
          })}
          <span className="ml-auto hidden items-center gap-1 pr-1 text-[10px] text-muted sm:flex">
            <Compass className="size-3.5" />
            True north
          </span>
        </div>
      )}
    </div>
  );
}
