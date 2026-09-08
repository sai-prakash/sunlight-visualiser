import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "sun" | "blocked" | "lit";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
        tone === "muted" && "bg-surface-2 text-muted",
        tone === "sun" && "bg-sun/15 text-sun",
        tone === "blocked" && "bg-blocked/15 text-blocked",
        tone === "lit" && "bg-lit/15 text-lit",
        className,
      )}
    >
      {children}
    </span>
  );
}
