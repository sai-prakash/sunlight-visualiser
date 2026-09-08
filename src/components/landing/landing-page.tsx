import { Link } from "@tanstack/react-router";
import { LazyCanvas } from "@/components/scene/lazy-canvas";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "01",
    title: "Pin the site",
    body: "GPS or a neighbourhood search. Elevation is pulled for the plot and the land around it.",
  },
  {
    n: "02",
    title: "Mark the open space",
    body: "Draw the terrace, courtyard, or room. That rectangle is what we score for the year.",
  },
  {
    n: "03",
    title: "Trace what stands in front",
    body: "A neighbouring tower, a hill, your own wing. Red is cut light. Gold is direct sun.",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <div className="absolute inset-0 h-[100dvh]">
        <LazyCanvas hero />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-bg/20" />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <span className="font-display text-xl tracking-tight">Solara</span>
          <Link
            to="/studio"
            className="text-sm text-muted transition-colors duration-150 hover:text-fg"
          >
            Open studio
          </Link>
        </header>

        <main className="mt-auto flex flex-col gap-8 px-5 pb-10 pt-16">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Sunlight for home buyers
            </p>
            <h1 className="mt-3 font-display text-[2.75rem] leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              See the sun before you buy.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
              Accurate solar position for any hour of the year. Mark a space, trace the towers that steal
              the light, walk the rooms. Red is blocked. Gold is open sky.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/studio">Open the studio</Link>
              </Button>
              <p className="self-center text-sm text-muted">Works as a phone PWA · Live AR on camera</p>
            </div>
          </div>

          <ol className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl bg-bg/70 p-4 backdrop-blur-sm">
                <div className="text-[11px] tabular-nums text-muted">{s.n}</div>
                <h2 className="mt-2 font-display text-xl leading-tight">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </main>
      </div>
    </div>
  );
}
