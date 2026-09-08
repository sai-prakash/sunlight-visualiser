/**
 * NOAA Solar Position Algorithm (spreadsheet equivalent).
 * Azimuth: degrees clockwise from true north.
 * Altitude: apparent degrees above the geometric horizon, refraction-corrected.
 * Accuracy: ~0.01° under typical conditions — survey-grade for site work.
 */
import type { SolarPosition, SunTimes } from "./types";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const SUN_RADIUS_REFRACT = 90.833; // official sunrise zenith (refraction + radius)

function wrap360(deg: number) {
  return ((deg % 360) + 360) % 360;
}

export function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function julianCentury(julian: number): number {
  return (julian - 2451545) / 36525;
}

function sind(d: number) {
  return Math.sin(d * RAD);
}
function cosd(d: number) {
  return Math.cos(d * RAD);
}

export function solarPosition(
  date: Date,
  lat: number,
  lon: number,
  elevationM = 0,
): SolarPosition {
  const julian = toJulian(date);
  const jc = julianCentury(julian);

  const geomMeanLong = wrap360(280.46646 + jc * (36000.76983 + jc * 0.0003032));
  const geomMeanAnom = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccent = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);

  const sunEqOfCtr =
    sind(geomMeanAnom) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    sind(2 * geomMeanAnom) * (0.019993 - 0.000101 * jc) +
    sind(3 * geomMeanAnom) * 0.000289;

  const sunTrueLong = geomMeanLong + sunEqOfCtr;
  const meanObliq =
    23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * cosd(125.04 - 1934.136 * jc);
  const sunAppLong =
    sunTrueLong - 0.00569 - 0.00478 * sind(125.04 - 1934.136 * jc);

  const decl = Math.asin(sind(obliqCorr) * sind(sunAppLong)) * DEG;

  const varY = Math.tan((obliqCorr / 2) * RAD) ** 2;
  const eqTime =
    4 *
    ((varY * sind(2 * geomMeanLong) -
      2 * eccent * sind(geomMeanAnom) +
      4 * eccent * varY * sind(geomMeanAnom) * cosd(2 * geomMeanLong) -
      0.5 * varY * varY * sind(4 * geomMeanLong) -
      1.25 * eccent * eccent * sind(2 * geomMeanAnom)) *
      DEG);

  const minutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  let trueSolarTime = minutes + eqTime + 4 * lon;
  trueSolarTime = ((trueSolarTime % 1440) + 1440) % 1440;
  const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  const latr = lat * RAD;
  const decr = decl * RAD;
  const ha = hourAngle * RAD;
  const cosZenith =
    Math.sin(latr) * Math.sin(decr) + Math.cos(latr) * Math.cos(decr) * Math.cos(ha);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith))) * DEG;

  const sinZenith = Math.sin(zenith * RAD);
  let azimuth = 0;
  if (sinZenith > 1e-12) {
    const arg = Math.max(
      -1,
      Math.min(1, (Math.sin(latr) * Math.cos(zenith * RAD) - Math.sin(decr)) / (Math.cos(latr) * sinZenith)),
    );
    const ac = Math.acos(arg) * DEG;
    azimuth = hourAngle > 0 ? wrap360(ac + 180) : wrap360(540 - ac);
  } else {
    azimuth = lat >= 0 ? 180 : 0;
  }

  const exoatm = 90 - zenith;
  let refraction = 0;
  if (exoatm <= 85) {
    const te = Math.tan(exoatm * RAD);
    if (exoatm > 5) {
      refraction = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    } else if (exoatm > -0.575) {
      refraction =
        1735 + exoatm * (-518.2 + exoatm * (103.4 + exoatm * (-12.79 + exoatm * 0.711)));
    } else {
      refraction = -20.774 / te;
    }
    refraction /= 3600;
  }

  // Horizon dip from observer height (high-rise floors see the sun slightly earlier).
  const R = 6371000;
  const dip = elevationM > 0 ? Math.acos(R / (R + elevationM)) * DEG : 0;

  const trueAltitude = 90 - zenith;
  const altitude = trueAltitude + refraction + dip * 0.15;

  return {
    azimuth,
    altitude,
    trueAltitude,
    declination: decl,
    zenith,
    hourAngle,
    equationOfTime: eqTime,
    julian,
  };
}

function hourAngleOfZenith(lat: number, decl: number, zenithDeg: number): number | null {
  const cosHa =
    (cosd(zenithDeg) - sind(lat) * sind(decl)) / (cosd(lat) * cosd(decl));
  if (cosHa < -1 || cosHa > 1) return null;
  return Math.acos(cosHa) * DEG;
}

function dateFromUTCMinutes(day: Date, utcMinutes: number): Date {
  const start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  const wrapped = ((utcMinutes % 1440) + 1440) % 1440;
  return new Date(start + wrapped * 60000);
}

export function sunTimes(date: Date, lat: number, lon: number, elevationM = 0): SunTimes {
  const noon = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0),
  );
  const pos = solarPosition(noon, lat, lon, elevationM);
  const decl = pos.declination;
  const eq = pos.equationOfTime;

  const R = 6371000;
  const dip = elevationM > 0 ? Math.acos(R / (R + elevationM)) * DEG : 0;
  const zenithRise = SUN_RADIUS_REFRACT - dip;

  const ha = hourAngleOfZenith(lat, decl, zenithRise) ?? 0;
  const haCivil = hourAngleOfZenith(lat, decl, 96) ?? ha + 6;
  const haGolden = hourAngleOfZenith(lat, decl, 84) ?? Math.max(0, ha - 6);

  const solarNoonMin = 720 - 4 * lon - eq;
  const sunriseMin = solarNoonMin - ha * 4;
  const sunsetMin = solarNoonMin + ha * 4;
  const dawnMin = solarNoonMin - haCivil * 4;
  const duskMin = solarNoonMin + haCivil * 4;
  const ghEnd = solarNoonMin - haGolden * 4;
  const gh = solarNoonMin + haGolden * 4;

  return {
    sunrise: dateFromUTCMinutes(date, sunriseMin),
    sunset: dateFromUTCMinutes(date, sunsetMin),
    solarNoon: dateFromUTCMinutes(date, solarNoonMin),
    dawn: dateFromUTCMinutes(date, dawnMin),
    dusk: dateFromUTCMinutes(date, duskMin),
    goldenHour: dateFromUTCMinutes(date, gh),
    goldenHourEnd: dateFromUTCMinutes(date, ghEnd),
  };
}

/** Unit direction toward the sun. World: +X east, +Y up, +Z south. */
export function sunDirection(azimuth: number, altitude: number): [number, number, number] {
  const az = azimuth * RAD;
  const alt = altitude * RAD;
  const c = Math.cos(alt);
  return [Math.sin(az) * c, Math.sin(alt), -Math.cos(az) * c];
}

export function airMass(zenithDeg: number): number {
  if (zenithDeg >= 90) return 40;
  const z = zenithDeg * RAD;
  const cosz = Math.cos(z);
  return 1 / (cosz + 0.025 * Math.exp(-11 * cosz));
}

/** Direct-beam irradiance approximation, W/m², clear dry sky (Ineichen-like). */
export function directIrradiance(altitude: number): number {
  if (altitude <= 0) return 0;
  const zenith = 90 - altitude;
  const m = airMass(zenith);
  return 1353 * Math.pow(0.7, Math.pow(m, 0.678));
}

export function isDaylight(pos: SolarPosition): boolean {
  return pos.altitude > -0.833;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function dayOfYear(date: Date): number {
  const y = date.getFullYear();
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  let doy = date.getDate();
  for (let m = 0; m < date.getMonth(); m++) {
    doy += MONTH_LENGTHS[m] + (m === 1 && leap ? 1 : 0);
  }
  return doy;
}

export function dateAtTime(base: Date, hours: number, minutes: number, seconds = 0): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

export function setLocalHMS(base: Date, h: number, m: number, s = 0): Date {
  const d = new Date(base.getTime());
  d.setHours(h, m, s, 0);
  return d;
}

export function fractionalHour(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function withFractionalHour(base: Date, hour: number): Date {
  const d = new Date(base.getTime());
  const h = Math.floor(hour);
  const m = Math.floor((hour - h) * 60);
  const s = Math.round(((hour - h) * 60 - m) * 60);
  d.setHours(h, m, s, 0);
  return d;
}

export function formatAzimuth(az: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const i = Math.round(wrap360(az) / 22.5) % 16;
  return `${wrap360(az).toFixed(1)}° ${dirs[i]}`;
}
