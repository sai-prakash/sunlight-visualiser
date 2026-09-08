import type { ReactNode } from "react";
import { useSolara } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  if (tool === "space") {
    return <Hint>Drag a rectangle on the ground to mark the open space — terrace, courtyard, or room.</Hint>;
  }
  if (tool === "blocker") {
    return <Hint>Drag a footprint, then set its height. Anything taller than the sun’s path turns the space red.</Hint>;
  }
  if (tool === "skyline") {
    return <Hint>Tap along the tops of buildings. That silhouette is the true horizon for this floor.</Hint>;
  }
  if (tool === "walk" || recording) {
    return <Hint>Tap the floor as you walk the rooms. Finish to store a 3D path you can replay against the sun.</Hint>;
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
        <div className="flex gap-2">
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

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface px-3 py-2.5 text-sm leading-relaxed text-muted">{children}</p>;
}
