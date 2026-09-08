import { useMemo } from "react";
import { useSolara } from "@/lib/store";
import { useSunNow } from "@/lib/solar/use-sun";
import { analyzeDay } from "@/lib/solar/year";
import { solsticeDates } from "@/lib/solar/year";
import { withFractionalHour } from "@/lib/solar/spa";
import { cn } from "@/lib/utils";

export function SunPathControl() {
  const sun = useSunNow();
  const setNow = useSolara((s) => s.setNow);
  const playing = useSolara((s) => s.playing);
  const setPlaying = useSolara((s) => s.setPlaying);
  const site = useSolara((s) => s.site);
  const spaces = useSolara((s) => s.spaces);
  const blockers = useSolara((s) => s.blockers);
  const selectedId = useSolara((s) => s.selectedId);
  const horizon = sun.horizon;

  const dayKey = `${sun.date.getFullYear()}-${sun.date.getMonth()}-${sun.date.getDate()}-${selectedId ?? ""}-${spaces.length}-${blockers.length}`;
  const summary = useMemo(
    () => analyzeDay(sun.date, site, spaces, blockers, horizon, selectedId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayKey, site.lat, site.lon],
  );

  const w = 320;
  const h = 72;
  const pad = 10;
  const riseM = summary.sunrise.getHours() * 60 + summary.sunrise.getMinutes();
  const setM = summary.sunset.getHours() * 60 + summary.sunset.getMinutes();
  const span = Math.max(60, setM - riseM);
  const nowM = sun.date.getHours() * 60 + sun.date.getMinutes();

  const xOf = (m: number) => pad + ((m - riseM) / span) * (w - pad * 2);
  const yOf = (alt: number) => h - 14 - Math.max(0, alt) / 90 * (h - 28);

  const dPath = useMemo(() => {
    if (summary.samples.length < 2) return "";
    return summary.samples
      .filter((s) => s.altitude > -1)
      .map((s, i) => `${i === 0 ? "M" : "L"} ${xOf(s.minutes).toFixed(1)} ${yOf(s.altitude).toFixed(1)}`)
      .join(" ");
  }, [summary.samples, span, riseM]);

  const segments = useMemo(() => {
    const pts = summary.samples.filter((s) => s.minutes >= riseM - 10 && s.minutes <= setM + 10);
    return pts.map((s, i) => {
      const next = pts[i + 1] ?? s;
      return {
        x1: xOf(s.minutes),
        y1: yOf(s.altitude),
        x2: xOf(next.minutes),
        y2: yOf(next.altitude),
        lit: s.litFraction > 0.2,
        alt: s.altitude,
      };
    });
  }, [summary.samples, span, riseM, setM]);

  const handleX = xOf(Math.min(setM, Math.max(riseM, nowM)));
  const handleY = yOf(Math.max(0, sun.pos.altitude));

  const onScrub = (clientX: number, rect: DOMRect) => {
    const t = (clientX - rect.left - pad) / (rect.width - pad * 2);
    const m = riseM + t * span;
    const hour = m / 60;
    setNow(withFractionalHour(sun.date, hour).getTime());
  };

  const jump = (d: Date) => setNow(d.getTime());
  const year = sun.date.getFullYear();
  const marks = solsticeDates(year);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[4.5rem] w-full touch-none select-none"
        role="slider"
        aria-label="Time of day"
        aria-valuemin={riseM}
        aria-valuemax={setM}
        aria-valuenow={nowM}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onScrub(e.clientX, rect);
          const move = (ev: PointerEvent) => onScrub(ev.clientX, rect);
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <line x1={pad} x2={w - pad} y1={h - 14} y2={h - 14} stroke="currentColor" className="text-border" />
        {segments.map((s, i) =>
          s.alt < 0 ? null : (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={s.lit ? "#e8b84a" : "#d4564a"}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ),
        )}
        {dPath ? <path d={dPath} fill="none" stroke="transparent" /> : null}
        <circle cx={handleX} cy={handleY} r={5.5} fill="#f2f1ee" />
        <circle cx={handleX} cy={handleY} r={2.5} fill="#0b0b0c" />
      </svg>
      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] tabular-nums text-muted">
          {summary.sunrise.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              "h-8 rounded-sm px-2.5 text-[11px] text-muted transition-colors duration-(--motion-quick) hover:text-fg",
              playing && "text-fg",
            )}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? "Pause" : "Play day"}
          </button>
          <button
            type="button"
            className="h-8 rounded-sm px-2 text-[11px] text-muted hover:text-fg"
            onClick={() => jump(marks.winter)}
          >
            21 Dec
          </button>
          <button
            type="button"
            className="h-8 rounded-sm px-2 text-[11px] text-muted hover:text-fg"
            onClick={() => jump(marks.summer)}
          >
            21 Jun
          </button>
          <button
            type="button"
            className="h-8 rounded-sm px-2 text-[11px] text-muted hover:text-fg"
            onClick={() => jump(new Date())}
          >
            Now
          </button>
        </div>
        <span className="text-[11px] tabular-nums text-muted">
          {summary.sunset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
