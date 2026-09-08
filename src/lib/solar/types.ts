export type Vec3 = { x: number; y: number; z: number };

export type SolarPosition = {
  /** Azimuth in degrees, 0 = true north, clockwise. */
  azimuth: number;
  /** Apparent altitude in degrees (refraction corrected). */
  altitude: number;
  /** True altitude before refraction. */
  trueAltitude: number;
  declination: number;
  zenith: number;
  hourAngle: number;
  equationOfTime: number;
  /** Julian date. */
  julian: number;
};

export type SunTimes = {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dawn: Date;
  dusk: Date;
  goldenHour: Date;
  goldenHourEnd: Date;
};

export type Blocker = {
  id: string;
  name: string;
  kind: "building" | "tree" | "wall";
  /** Center X (east, meters from origin). */
  cx: number;
  /** Center Z (south, meters from origin). */
  cz: number;
  width: number;
  depth: number;
  height: number;
  /** Yaw in degrees, clockwise from north. */
  rotation: number;
  /** Ground elevation of the base, meters above site ground. */
  baseElevation: number;
};

export type Space = {
  id: string;
  name: string;
  cx: number;
  cz: number;
  width: number;
  depth: number;
  rotation: number;
  /** Floor height above site ground, meters. */
  elevation: number;
};

export type WalkPoint = {
  x: number;
  y: number;
  z: number;
  t: number;
};

export type WalkSession = {
  id: string;
  name: string;
  points: WalkPoint[];
  closed: boolean;
};

export type Site = {
  lat: number;
  lon: number;
  /** Meters above sea level. */
  elevation: number;
  label: string;
  timezone: string;
  /** Magnetic declination, degrees east-positive. */
  magDeclination: number;
};

export type OcclusionHit = {
  blocked: boolean;
  by?: string;
  kind?: "building" | "skyline" | "terrain" | "horizon";
};

export type DaySample = {
  minutes: number;
  altitude: number;
  azimuth: number;
  litFraction: number;
  blockedBy: string | null;
};

export type DaySummary = {
  date: Date;
  sunrise: Date;
  sunset: Date;
  hoursDirect: number;
  hoursAny: number;
  peakLit: number;
  firstDirect: Date | null;
  lastDirect: Date | null;
  samples: DaySample[];
  dominantBlocker: string | null;
};

export type YearDay = {
  doy: number;
  month: number;
  day: number;
  hoursDirect: number;
  firstHour: number | null;
  lastHour: number | null;
};

export const HORIZON_BINS = 360;
