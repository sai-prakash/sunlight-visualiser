import { Badge } from "@/components/ui/badge";
import { useSunNow } from "@/lib/solar/use-sun";
import { formatAzimuth } from "@/lib/solar/spa";
import { formatHours } from "@/lib/utils";
import { useSolara } from "@/lib/store";
import { analyzeDay } from "@/lib/solar/year";
import { useMemo } from "react";

export function Hud() {
  const sun = useSunNow();
  const site = useSolara((s) => s.site);
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const floorHeight = useSolara((s) => s.floorHeight);

  const dayKey = `${sun.date.getFullYear()}-${sun.date.getMonth()}-${sun.date.getDate()}`;
  const summary = useMemo(
    () => analyzeDay(sun.date, site, spaces, blockers, sun.horizon),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayKey, site.lat, site.lon, spaces, blockers],
  );

  const blocked = sun.lit.fraction < 0.2 && sun.pos.altitude > 0;
  const lit = sun.lit.fraction >= 0.2 && sun.pos.altitude > 0;

  return (
    <div className="pointer-events-none flex w-full flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {site.label}
          </p>
          <p className="mt-0.5 font-display text-lg leading-tight text-fg">
            {sun.date.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {sun.pos.altitude <= 0 ? (
            <Badge>Below horizon</Badge>
          ) : blocked ? (
            <Badge tone="blocked">{sun.lit.blockedBy ?? "Blocked"}</Badge>
          ) : lit ? (
            <Badge tone="sun">Direct sun</Badge>
          ) : (
            <Badge>Partial</Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
        <Stat label="Altitude" value={`${sun.pos.altitude.toFixed(1)}°`} />
        <Stat label="Azimuth" value={formatAzimuth(sun.pos.azimuth)} />
        <Stat label="Space lit" value={`${Math.round(sun.lit.fraction * 100)}%`} />
        <Stat label="Direct today" value={formatHours(summary.hoursDirect)} />
        <Stat label="Floor" value={`${floorHeight.toFixed(1)} m`} />
        <Stat label="Site elev." value={`${Math.round(site.elevation)} m`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-bg/55 px-2.5 py-2 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-0.5 text-[12px] text-fg">{value}</div>
    </div>
  );
}
