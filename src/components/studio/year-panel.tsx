import { useMemo } from "react";
import { useSolara } from "@/lib/store";
import { useSiteHorizon, useSunNow } from "@/lib/solar/use-sun";
import { analyzeDay, analyzeYear, insightCopy, solsticeDates } from "@/lib/solar/year";
import { formatHours } from "@/lib/utils";
import { setLocalHMS } from "@/lib/solar/spa";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function YearPanel() {
  const sun = useSunNow();
  const horizon = useSiteHorizon();
  const site = useSolara((s) => s.site);
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const selectedId = useSolara((s) => s.selectedId);
  const setNow = useSolara((s) => s.setNow);

  const year = sun.date.getFullYear();

  const days = useMemo(
    () => analyzeYear(year, site, spaces, blockers, horizon, selectedId),
    [year, site, spaces, blockers, horizon, selectedId],
  );

  const marks = solsticeDates(year);
  const winter = useMemo(
    () => analyzeDay(marks.winter, site, spaces, blockers, horizon, selectedId),
    [year, site, spaces, blockers, horizon, selectedId],
  );
  const summer = useMemo(
    () => analyzeDay(marks.summer, site, spaces, blockers, horizon, selectedId),
    [year, site, spaces, blockers, horizon, selectedId],
  );
  const dayStamp = `${sun.date.getFullYear()}-${sun.date.getMonth()}-${sun.date.getDate()}-${selectedId ?? ""}`;
  const today = useMemo(
    () => analyzeDay(sun.date, site, spaces, blockers, horizon, selectedId),
    [dayStamp, site, spaces, blockers, horizon, selectedId],
  );

  const maxH = Math.max(1, ...days.map((d) => d.hoursDirect));
  const copy = insightCopy(today, winter.hoursDirect, summer.hoursDirect);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{year} insolation</p>
        <h2 className="mt-1 font-display text-2xl leading-tight">
          {today.spaceName ?? "Marked space"}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">{copy}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Today" value={formatHours(today.hoursDirect)} />
        <Fact label="21 Jun" value={formatHours(summer.hoursDirect)} />
        <Fact label="21 Dec" value={formatHours(winter.hoursDirect)} />
        <Fact
          label="Year mean"
          value={formatHours(days.reduce((a, d) => a + d.hoursDirect, 0) / Math.max(1, days.length))}
        />
      </div>

      <div className="rounded-lg bg-surface p-3">
        <div className="flex h-24 items-end gap-px">
          {days.map((d) => {
            const t = d.hoursDirect / maxH;
            const hue = d.hoursDirect < 1.2 ? "#d4564a" : d.hoursDirect < 3 ? "#c4a36a" : "#e8b84a";
            return (
              <button
                key={d.doy}
                type="button"
                title={`${MONTHS[d.month]} ${d.day}: ${d.hoursDirect.toFixed(1)}h`}
                className="min-w-0 flex-1 rounded-sm"
                style={{ height: `${Math.max(6, t * 100)}%`, background: hue }}
                onClick={() => setNow(setLocalHMS(new Date(year, d.month, d.day), 12, 0).getTime())}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.12em] text-muted">
          {MONTHS.filter((_, i) => i % 2 === 0).map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">This day, by hour</p>
        <div className="flex h-16 items-end gap-0.5">
          {today.samples
            .filter((s) => s.altitude > -1)
            .map((s) => (
              <div
                key={s.minutes}
                className="min-w-0 flex-1 rounded-sm"
                style={{
                  height: `${Math.max(4, s.litFraction * 100)}%`,
                  background: s.litFraction > 0.2 ? "#e8b84a" : "#d4564a",
                  opacity: 0.35 + s.litFraction * 0.65,
                }}
              />
            ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
          <span>{today.sunrise.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span>{today.sunset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-1 font-display text-xl tabular-nums text-fg">{value}</div>
    </div>
  );
}
