import { BoxSelect, Building2, Footprints, Move, ScanLine, Upload } from "lucide-react";
import { useSolara, type StudioView, type Tool } from "@/lib/store";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; label: string; icon: typeof Move; views: StudioView[] }[] = [
  { id: "orbit", label: "Move", icon: Move, views: ["map", "site"] },
  { id: "space", label: "Space", icon: BoxSelect, views: ["map", "site"] },
  { id: "blocker", label: "Blocker", icon: Building2, views: ["map", "site"] },
  { id: "plan", label: "Plan", icon: Upload, views: ["map", "site"] },
  { id: "skyline", label: "Skyline", icon: ScanLine, views: ["site", "ar"] },
  { id: "walk", label: "Walk", icon: Footprints, views: ["site", "ar"] },
];

const VIEWS: { id: StudioView; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "site", label: "3D" },
  { id: "year", label: "Year" },
  { id: "ar", label: "AR" },
];

export function ViewSwitch() {
  const view = useSolara((s) => s.view);
  const setView = useSolara((s) => s.setView);
  return (
    <div className="flex rounded-full bg-bg/75 p-1 backdrop-blur-sm">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => setView(v.id)}
          className={cn(
            "h-9 min-w-11 rounded-full px-3 text-sm font-medium transition-colors duration-(--motion-quick)",
            view === v.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function ToolDock() {
  const tool = useSolara((s) => s.tool);
  const setTool = useSolara((s) => s.setTool);
  const view = useSolara((s) => s.view);
  const recording = useSolara((s) => s.recording);
  const startWalk = useSolara((s) => s.startWalk);
  const finishWalk = useSolara((s) => s.finishWalk);

  const visible = TOOLS.filter((t) => t.views.includes(view));
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {visible.map((t) => {
        const Icon = t.icon;
        const active = tool === t.id || (t.id === "walk" && recording);
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
    </div>
  );
}
