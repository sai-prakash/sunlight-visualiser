import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { decimalYear, magneticDeclination } from "@/lib/geo/wmm";
import { emptyHorizon, mergeHorizon, stampHorizonPoint } from "@/lib/solar/occlusion";
import type { Blocker, FloorPlan, Site, Space, WalkPoint, WalkSession } from "@/lib/solar/types";
import { HORIZON_BINS } from "@/lib/solar/types";
import { demoBlockers, demoHorizon, demoSite, demoSpaces, demoWalk } from "@/lib/site/demo";
import { EMPTY_POSE, type LivePose } from "@/lib/ar/pose-tracker";

export type Tool = "orbit" | "space" | "blocker" | "skyline" | "walk" | "plan";
export type StudioView = "map" | "site" | "year" | "ar";

type Persisted = {
  site: Site;
  spaces: Space[];
  blockers: Blocker[];
  userHorizon: number[];
  walks: WalkSession[];
  floorHeight: number;
  headingOffset: number;
  floorPlan: FloorPlan | null;
};

type State = Persisted & {
  now: number;
  playing: boolean;
  tool: Tool;
  view: StudioView;
  selectedId: string | null;
  recording: boolean;
  playSpeed: number;
  hydrated: boolean;
  livePose: LivePose;
  headingLocked: boolean;
  setNow: (ts: number) => void;
  setPlaying: (v: boolean) => void;
  setTool: (t: Tool) => void;
  setView: (v: StudioView) => void;
  setSelected: (id: string | null) => void;
  setSite: (partial: Partial<Site>) => void;
  setFloorHeight: (h: number) => void;
  addSpace: (s: Omit<Space, "id"> & { id?: string }) => void;
  updateSpace: (id: string, partial: Partial<Space>) => void;
  removeSpace: (id: string) => void;
  addBlocker: (b: Omit<Blocker, "id"> & { id?: string }) => void;
  updateBlocker: (id: string, partial: Partial<Blocker>) => void;
  removeBlocker: (id: string) => void;
  stampSkyline: (az: number, alt: number) => void;
  resetSkyline: () => void;
  setUserHorizon: (h: number[]) => void;
  startWalk: () => void;
  addWalkPoint: (p: WalkPoint) => void;
  finishWalk: () => void;
  resetDemo: () => void;
  tick: (dtMs: number) => void;
  setLivePose: (p: LivePose) => void;
  addHeadingOffset: (delta: number) => void;
  resetHeadingOffset: () => void;
  setFloorPlan: (p: FloorPlan | null) => void;
  updateFloorPlan: (partial: Partial<FloorPlan>) => void;
  replaceOsmBlockers: (osm: Blocker[]) => void;
  resetGeometry: () => void;
};

const seed = (): Persisted => ({
  site: demoSite(),
  spaces: demoSpaces(),
  blockers: demoBlockers(),
  userHorizon: demoHorizon(),
  walks: [demoWalk()],
  floorHeight: 15.2,
  headingOffset: 0,
  floorPlan: null,
});

export const useSolara = create<State>()(
  persist(
    (set, get) => ({
      ...seed(),
      now: Date.now(),
      playing: false,
      tool: "orbit",
      view: "map",
      selectedId: null,
      recording: false,
      playSpeed: 240,
      hydrated: false,
      livePose: EMPTY_POSE,
      headingLocked: false,
      setNow: (ts) => set({ now: ts, playing: false }),
      setPlaying: (v) => set({ playing: v }),
      setTool: (t) => set({ tool: t }),
      setView: (v) => set({ view: v }),
      setSelected: (id) => set({ selectedId: id }),
      setSite: (partial) => {
        const site = { ...get().site, ...partial };
        if (partial.lat != null || partial.lon != null) {
          site.magDeclination = magneticDeclination(
            site.lat,
            site.lon,
            decimalYear(new Date(get().now)),
            site.elevation / 1000,
          );
        }
        set({ site });
      },
      setFloorHeight: (h) => {
        const spaces = get().spaces.map((s) => ({ ...s, elevation: h }));
        set({ floorHeight: h, spaces });
      },
      addSpace: (s) => {
        const id = s.id ?? uid("space");
        set({
          spaces: [...get().spaces, { ...s, id }],
          tool: "orbit",
          selectedId: id,
        });
      },
      updateSpace: (id, partial) =>
        set({
          spaces: get().spaces.map((s) => (s.id === id ? { ...s, ...partial } : s)),
        }),
      removeSpace: (id) => set({ spaces: get().spaces.filter((s) => s.id !== id) }),
      addBlocker: (b) => {
        const id = b.id ?? uid("blk");
        set({
          blockers: [...get().blockers, { ...b, id, source: b.source ?? "user" }],
          tool: "orbit",
          selectedId: id,
        });
      },
      updateBlocker: (id, partial) =>
        set({
          blockers: get().blockers.map((b) => (b.id === id ? { ...b, ...partial } : b)),
        }),
      removeBlocker: (id) => set({ blockers: get().blockers.filter((b) => b.id !== id) }),
      stampSkyline: (az, alt) => {
        const next = get().userHorizon.slice();
        if (next.length !== HORIZON_BINS) {
          const filled = emptyHorizon();
          for (let i = 0; i < Math.min(next.length, HORIZON_BINS); i++) filled[i] = next[i] ?? -0.833;
          stampHorizonPoint(filled, az, alt, 2);
          set({ userHorizon: filled });
          return;
        }
        stampHorizonPoint(next, az, alt, 2);
        set({ userHorizon: next });
      },
      resetSkyline: () => set({ userHorizon: emptyHorizon() }),
      setUserHorizon: (h) => set({ userHorizon: mergeHorizon(get().userHorizon, h) }),
      startWalk: () =>
        set({
          recording: true,
          tool: "walk",
          walks: [
            ...get().walks.filter((w) => w.points.length > 1),
            { id: uid("walk"), name: "Walk", points: [], closed: false },
          ],
        }),
      addWalkPoint: (p) => {
        const walks = get().walks.slice();
        const last = walks[walks.length - 1];
        if (!last || last.closed) return;
        last.points = [...last.points, p];
        set({ walks });
      },
      finishWalk: () => {
        const walks = get().walks.map((w, i, arr) =>
          i === arr.length - 1 ? { ...w, closed: true } : w,
        );
        set({ walks, recording: false, tool: "orbit" });
      },
      resetDemo: () =>
        set({
          ...seed(),
          now: Date.now(),
          selectedId: null,
          headingLocked: false,
          livePose: EMPTY_POSE,
          view: get().view,
        }),
      tick: (dtMs) => {
        if (!get().playing) return;
        const speed = get().playSpeed;
        set({ now: get().now + dtMs * speed });
      },
      setLivePose: (p) => set({ livePose: p }),
      addHeadingOffset: (delta) =>
        set({ headingOffset: get().headingOffset + delta, headingLocked: true }),
      resetHeadingOffset: () => set({ headingOffset: 0, headingLocked: false }),
      setFloorPlan: (p) => set({ floorPlan: p, tool: p ? "plan" : get().tool }),
      updateFloorPlan: (partial) => {
        const cur = get().floorPlan;
        if (!cur) return;
        set({ floorPlan: { ...cur, ...partial } });
      },
      replaceOsmBlockers: (osm) => {
        const kept = get().blockers.filter((b) => b.source === "user");
        set({ blockers: [...kept, ...osm] });
      },
      resetGeometry: () =>
        set({
          spaces: [],
          blockers: [],
          userHorizon: emptyHorizon(),
          walks: [],
          floorPlan: null,
          selectedId: null,
        }),
    }),
    {
      name: "solara.v3",
      partialize: (s) => ({
        site: s.site,
        spaces: s.spaces,
        blockers: s.blockers,
        userHorizon: s.userHorizon,
        walks: s.walks,
        floorHeight: s.floorHeight,
        headingOffset: s.headingOffset,
        floorPlan: s.floorPlan,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
          if (!state.floorPlan) state.floorPlan = null;
          if (state.site) {
            state.site.magDeclination = magneticDeclination(
              state.site.lat,
              state.site.lon,
              decimalYear(),
              state.site.elevation / 1000,
            );
          }
        }
      },
    },
  ),
);
