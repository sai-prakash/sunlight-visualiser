import { useMemo } from "react";
import { useSolara } from "@/lib/store";
import { useSunNow } from "@/lib/solar/use-sun";
import { analyzeDay } from "@/lib/solar/year";
import { formatHours } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function DayStrip() {
  const sun = useSunNow();
  const site = useSolara((s) => s.site);
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const selectedId = useSolara((s) => s.selectedId);
  const setSelected = useSolara((s) => s.setSelected);

  const dayKey = `${sun.date.getFullYear()}-${sun.date.getMonth()}-${sun.date.getDate()}-${selectedId ?? ""}`;
  const summary = useMemo(
    () => analyzeDay(sun.date, site, spaces, blockers, sun.horizon, selectedId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayKey, site.lat, site.lon, spaces, blockers],
  );

  const blocked = sun.lit.fraction < 0.2 && sun.pos.altitude > 0;
  const lit = sun.lit.fraction >= 0.2 && sun.pos.altitude > 0;
  const space = sun.space;

  const first = summary.firstDirect
    ? summary.firstDirect.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const last = summary.lastDirect
    ? summary.lastDirect.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-col gap-2">
      {spaces.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto">
          {spaces.map((s) => {
            const on = (selectedId ?? spaces[0]?.id) === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected(s.id)}
                className={
                  on
                    ? "h-8 shrink-0 rounded-full bg-accent px-3 text-xs font-medium text-accent-fg"
                    : "h-8 shrink-0 rounded-full bg-surface-2 px-3 text-xs text-muted"
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {space?.name ?? "Mark a balcony or room"}
          </p>
          <p className="mt-0.5 font-display text-xl leading-tight tabular-nums text-fg">
            {sun.pos.altitude <= 0
              ? "Below the horizon"
              : `${Math.round(sun.lit.fraction * 100)}% of the floor in sun`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {first && last
              ? `Direct ${first}–${last} · ${formatHours(summary.hoursDirect)} today`
              : sun.pos.altitude <= 0
                ? `Sunrise ${summary.sunrise.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "No direct sun on this space today"}
            {summary.dominantBlocker ? ` · ${summary.dominantBlocker} cuts the rest` : ""}
          </p>
        </div>
        <div className="shrink-0">
          {sun.pos.altitude <= 0 ? (
            <Badge>Night</Badge>
          ) : blocked ? (
            <Badge tone="blocked">{sun.lit.blockedBy ?? "Blocked"}</Badge>
          ) : lit ? (
            <Badge tone="sun">Direct sun</Badge>
          ) : (
            <Badge>Partial</Badge>
          )}
        </div>
      </div>

      <HourRibbon samples={summary.samples} nowM={sun.date.getHours() * 60 + sun.date.getMinutes()} />
    </div>
  );
}

function HourRibbon({
  samples,
  nowM,
}: {
  samples: { minutes: number; altitude: number; litFraction: number }[];
  nowM: number;
}) {
  const day = samples.filter((s) => s.altitude > -0.5);
  if (day.length < 4) return null;
  const t0 = day[0]!.minutes;
  const t1 = day[day.length - 1]!.minutes;
  const span = Math.max(1, t1 - t0);
  const nowX = ((Math.min(t1, Math.max(t0, nowM)) - t0) / span) * 100;

  return (
    <div className="relative h-7 overflow-hidden rounded-md bg-surface-2">
      <div className="flex h-full">
        {day.map((s) => (
          <div
            key={s.minutes}
            className="h-full min-w-0 flex-1"
            style={{
              background:
                s.litFraction > 0.2
                  ? `rgba(232, 184, 74, ${0.35 + s.litFraction * 0.65})`
                  : `rgba(212, 86, 74, ${0.25 + (1 - s.litFraction) * 0.35})`,
            }}
            title={`${Math.floor(s.minutes / 60)
              .toString()
              .padStart(2, "0")}:${(s.minutes % 60).toString().padStart(2, "0")}`}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute top-0 h-full w-px bg-fg"
        style={{ left: `${nowX}%` }}
      />
    </div>
  );
}
