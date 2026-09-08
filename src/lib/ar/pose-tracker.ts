import { attitudeFromEuler, OneEuro, screenOrientationDeg } from "@/lib/geo/orientation";
import { geodeticToEnu, type Enu } from "@/lib/geo/enu";
import { trueHeadingFromMagnetic } from "@/lib/geo/wmm";
import { wrap360 } from "@/lib/utils";

export type PoseSource = "lidar" | "world" | "absolute" | "compass" | "relative" | "none";

export type LivePose = {
  heading: number;
  pitch: number;
  roll: number;
  headingAccuracy: number;
  east: number;
  north: number;
  up: number;
  accuracyM: number;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  source: PoseSource;
  hasLidar: boolean;
  hasDepth: boolean;
  hitDistance: number | null;
  compassCalibrated: boolean;
  gpsActive: boolean;
  needsFigure8: boolean;
  frame: number;
};

export const EMPTY_POSE: LivePose = {
  heading: 0,
  pitch: 0,
  roll: 0,
  headingAccuracy: 45,
  east: 0,
  north: 0,
  up: 0,
  accuracyM: 999,
  lat: null,
  lon: null,
  alt: null,
  source: "none",
  hasLidar: false,
  hasDepth: false,
  hitDistance: null,
  compassCalibrated: false,
  gpsActive: false,
  needsFigure8: false,
  frame: 0,
};

type Origin = { lat: number; lon: number; alt: number };

export class PoseTracker {
  pose: LivePose = { ...EMPTY_POSE };
  private declination = 0;
  private headingOffset = 0;
  private origin: Origin | null = null;
  private headingFilter = new OneEuro(1.2, 0.04, 1);
  private pitchFilter = new OneEuro(1.4, 0.02, 1);
  private rollFilter = new OneEuro(1.4, 0.02, 1);
  private absAlpha: number | null = null;
  private usedAbsolute = false;
  private compassAccuracy = 40;
  private geoWatch: number | null = null;
  private oriHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private absHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  private live = false;

  configure(opts: { declination: number; headingOffset: number; origin: Origin | null }) {
    this.declination = opts.declination;
    this.headingOffset = opts.headingOffset;
    this.origin = opts.origin;
  }

  async requestPermissions(): Promise<{ motion: boolean; geo: boolean }> {
    let motion = true;
    try {
      const DOE = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE.requestPermission === "function") {
        const r = await DOE.requestPermission();
        motion = r === "granted";
      }
      const DME = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DME.requestPermission === "function") {
        await DME.requestPermission().catch(() => "denied");
      }
    } catch {
      motion = false;
    }
    return { motion, geo: Boolean(navigator.geolocation) };
  }

  start() {
    if (this.live || typeof window === "undefined") return;
    this.live = true;
    this.headingFilter.reset();
    this.pitchFilter.reset();
    this.rollFilter.reset();

    const applyOrientation = (e: DeviceOrientationEvent, absolute: boolean) => {
      const screen = screenOrientationDeg();
      const alpha = e.alpha ?? 0;
      const beta = e.beta ?? 90;
      const gamma = e.gamma ?? 0;
      const att = attitudeFromEuler(alpha, beta, gamma, screen);
      const webkit = e as DeviceOrientationEvent;
      const compass =
        typeof webkit.webkitCompassHeading === "number" ? webkit.webkitCompassHeading : null;
      const acc =
        typeof webkit.webkitCompassAccuracy === "number" ? webkit.webkitCompassAccuracy : null;

      if (absolute && e.alpha != null) {
        this.absAlpha = e.alpha;
        this.usedAbsolute = true;
      }
      if (acc != null) this.compassAccuracy = acc < 0 ? 45 : acc;

      let heading = att.heading;
      let source: PoseSource = "relative";
      let headingAccuracy = 25;
      let needsFigure8 = false;

      if (this.usedAbsolute && this.absAlpha != null) {
        heading = att.heading;
        source = "absolute";
        headingAccuracy = 4;
      } else if (compass != null) {
        heading = trueHeadingFromMagnetic(compass, this.declination);
        source = "compass";
        headingAccuracy = Math.max(3, this.compassAccuracy || 15);
        needsFigure8 = this.compassAccuracy < 0 || this.compassAccuracy > 25;
      } else {
        heading = trueHeadingFromMagnetic(wrap360(360 - alpha), this.declination);
        source = "relative";
        headingAccuracy = 30;
      }

      heading = wrap360(heading + this.headingOffset);
      const now = performance.now();
      heading = this.headingFilter.filter(heading, now, true);
      const pitch = this.pitchFilter.filter(att.pitch, now);
      const roll = this.rollFilter.filter(att.roll, now);

      this.pose = {
        ...this.pose,
        heading,
        pitch,
        roll,
        headingAccuracy,
        source: this.pose.hasLidar ? this.pose.source : source,
        compassCalibrated: !needsFigure8 && source !== "relative",
        needsFigure8,
        frame: this.pose.frame + 1,
      };
    };

    this.oriHandler = (e) => applyOrientation(e, false);
    this.absHandler = (e) => applyOrientation(e, true);
    window.addEventListener("deviceorientation", this.oriHandler, true);
    window.addEventListener("deviceorientationabsolute", this.absHandler, true);
    this.startGps();
  }

  startGps() {
    if (!navigator.geolocation || this.geoWatch != null) return;
    this.geoWatch = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude;
        const acc = pos.coords.accuracy || 50;
        let enu: Enu = { east: 0, north: 0, up: 0 };
        if (this.origin) {
          enu = geodeticToEnu(lat, lon, alt ?? this.origin.alt, this.origin.lat, this.origin.lon, this.origin.alt);
        }
        const gpsHeading = pos.coords.heading;
        const speed = pos.coords.speed ?? 0;
        let heading = this.pose.heading;
        let source = this.pose.source;
        if (gpsHeading != null && Number.isFinite(gpsHeading) && speed != null && speed > 1.4) {
          heading = this.headingFilter.filter(wrap360(gpsHeading + this.headingOffset), performance.now(), true);
          if (source === "relative" || source === "none") source = "compass";
        }
        this.pose = {
          ...this.pose,
          east: enu.east,
          north: enu.north,
          up: enu.up,
          accuracyM: acc,
          lat,
          lon,
          alt,
          gpsActive: true,
          heading,
          source,
          frame: this.pose.frame + 1,
        };
      },
      () => {
        this.pose = { ...this.pose, gpsActive: false };
      },
      { enableHighAccuracy: true, maximumAge: 800, timeout: 12000 },
    );
  }

  applyXr(partial: {
    heading?: number;
    pitch?: number;
    roll?: number;
    east?: number;
    north?: number;
    up?: number;
    hitDistance?: number | null;
    hasLidar?: boolean;
    hasDepth?: boolean;
    source?: PoseSource;
  }) {
    const now = performance.now();
    const heading =
      partial.heading != null
        ? this.headingFilter.filter(wrap360(partial.heading + this.headingOffset), now, true)
        : this.pose.heading;
    this.pose = {
      ...this.pose,
      heading,
      pitch: partial.pitch ?? this.pose.pitch,
      roll: partial.roll ?? this.pose.roll,
      east: partial.east ?? this.pose.east,
      north: partial.north ?? this.pose.north,
      up: partial.up ?? this.pose.up,
      hitDistance: partial.hitDistance ?? this.pose.hitDistance,
      hasLidar: partial.hasLidar ?? this.pose.hasLidar,
      hasDepth: partial.hasDepth ?? this.pose.hasDepth,
      source: partial.source ?? this.pose.source,
      headingAccuracy: partial.hasLidar ? 1.2 : this.pose.headingAccuracy,
      compassCalibrated: true,
      needsFigure8: false,
      frame: this.pose.frame + 1,
    };
  }

  stop() {
    this.live = false;
    if (this.oriHandler) window.removeEventListener("deviceorientation", this.oriHandler, true);
    if (this.absHandler) window.removeEventListener("deviceorientationabsolute", this.absHandler, true);
    this.oriHandler = null;
    this.absHandler = null;
    if (this.geoWatch != null) {
      navigator.geolocation.clearWatch(this.geoWatch);
      this.geoWatch = null;
    }
  }
}

export function sourceLabel(source: PoseSource, hasLidar: boolean) {
  if (hasLidar || source === "lidar") return "LiDAR";
  if (source === "world") return "World tracking";
  if (source === "absolute") return "True north";
  if (source === "compass") return "Compass";
  if (source === "relative") return "Gyro";
  return "No heading";
}
