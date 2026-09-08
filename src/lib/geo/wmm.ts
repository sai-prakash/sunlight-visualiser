/**
 * WMM2025 (epoch 2025.0, valid 2025–2030).
 * Schmidt quasi-normalized spherical harmonics, WGS84 geodetic → geocentric.
 * Declination to ~0.1° at mid latitudes — enough for true-north AR.
 */
const EPOCH = 2025.0;
const NMAX = 12;
const NCOEFF = 91;
const WGS84_A = 6378.137;
const WGS84_ESQ = 0.00669437999014;
const EARTH_R = 6371.2;

const idx = (n: number, m: number) => (n * (n + 1)) / 2 + m;

// n*(n+1)/2+m, n=0 unused. NOAA WMM2025COF.
const GNM = [
  0.0, -29351.8, -1410.8, -2556.6, 2951.1, 1649.3, 1361.0, -2404.1, 1243.8, 453.6, 895.0, 799.5, 55.7, -281.1, 12.1,
  -233.2, 368.9, 187.2, -138.7, -142.0, 20.9, 64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7, 79.5, -77.0, -8.8, 59.3,
  15.8, 2.5, -11.1, 14.2, 23.2, 10.8, -17.5, 2.0, -21.7, 16.9, 15.0, -16.8, 0.9, 4.6, 7.8, 3.0, -0.2, -2.5, -13.1, 2.4,
  8.6, -8.7, -12.9, -1.3, -6.4, 0.2, 2.0, -1.0, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9, 2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6,
  -0.1, 1.1, -1.0, -0.2, 2.6, -2.0, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7,
];
const HNM = [
  0.0, 0.0, 4545.4, 0.0, -3133.6, -815.1, 0.0, -56.6, 237.5, -549.5, 0.0, 278.6, -133.9, 212.0, -375.6, 0.0, 45.4, 220.2,
  -122.9, 43.0, 106.1, 0.0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7, 0.0, -48.9, -14.4, -1.0, 23.4, -7.4, -25.1, -2.3, 0.0,
  7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9, 0.0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10.0, 0.0, 3.3, 0.0,
  2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1, 0.0, 0.0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3, 0.0,
  -1.3, 0.7, 1.0, -1.4, 0.0, 0.6, -0.1, 0.8, 0.1, -1.0, 0.1, 0.2,
];
const GTNM = [
  0.0, 12.0, 9.7, -11.6, -5.2, -8.0, -1.3, -4.2, 0.4, -15.6, -1.6, -2.4, -6.0, 5.6, -7.0, 0.6, 1.4, 0.0, 0.6, 2.2, 0.9,
  -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9, 0.0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8, -0.1, 0.2, 0.0, 0.5, -0.1, 0.3, 0.2,
  0.0, 0.2, 0.0, -0.1, 0.1, 0.3, -0.3, 0.0, 0.3, -0.1, 0.1, -0.1, 0.1, 0.0, 0.1, 0.1, 0.0, -0.3, 0.0, -0.1, -0.1, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1, 0.0, 0.0, -0.1, -0.1, -0.1, -0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0,
  -0.1, 0.0, -0.1,
];
const HTNM = [
  0.0, 0.0, -21.5, 0.0, -27.7, -12.1, 0.0, 4.0, -0.3, -4.1, 0.0, -1.1, 4.1, 1.6, -4.4, 0.0, -0.5, 2.2, 0.4, 1.7, 1.9, 0.0,
  0.3, -1.6, -0.4, 0.9, 0.7, 0.9, 0.0, 0.6, 0.5, -0.8, 0.0, -1.0, 0.6, -0.2, 0.0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3,
  0.2, 0.0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1, 0.0, 0.0, 0.0, -0.2, 0.1, -0.1, 0.1, 0.0, -0.1, 0.2, 0.0, 0.0,
  0.0, 0.1, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.1,
];

export function decimalYear(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const next = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (next - start);
}

/**
 * Magnetic declination in degrees (east positive) at geodetic lat/lon.
 * `altKm` is kilometres AMSL — a few hundred metres does not move a phone compass.
 */
export function magneticDeclination(lat: number, lon: number, year = 2026, altKm = 0): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 0;
  const dt = year - EPOCH;
  let latDeg = lat;
  if (latDeg > 89.9999) latDeg = 89.9999;
  if (latDeg < -89.9999) latDeg = -89.9999;

  const g = new Array<number>(NCOEFF);
  const h = new Array<number>(NCOEFF);
  for (let i = 0; i < NCOEFF; i++) {
    g[i] = (GNM[i] ?? 0) + (GTNM[i] ?? 0) * dt;
    h[i] = (HNM[i] ?? 0) + (HTNM[i] ?? 0) * dt;
  }

  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  const rc0 = WGS84_A / Math.sqrt(1 - WGS84_ESQ * sinLat * sinLat);
  const xp0 = (rc0 + altKm) * cosLat;
  const zp0 = (rc0 * (1 - WGS84_ESQ) + altKm) * sinLat;
  const r = Math.sqrt(xp0 * xp0 + zp0 * zp0);
  const gcLat = Math.asin(zp0 / r);
  const sinGc = Math.sin(gcLat);
  const cosGc = Math.cos(gcLat);

  const rr: number[] = new Array(NMAX + 1);
  const ratio = EARTH_R / r;
  rr[0] = ratio * ratio;
  for (let n = 1; n <= NMAX; n++) rr[n] = (rr[n - 1] as number) * ratio;

  const cosMl: number[] = new Array(NMAX + 1);
  const sinMl: number[] = new Array(NMAX + 1);
  cosMl[0] = 1;
  sinMl[0] = 0;
  cosMl[1] = Math.cos(lonRad);
  sinMl[1] = Math.sin(lonRad);
  for (let m = 2; m <= NMAX; m++) {
    cosMl[m] = (cosMl[m - 1] as number) * (cosMl[1] as number) - (sinMl[m - 1] as number) * (sinMl[1] as number);
    sinMl[m] = (sinMl[m - 1] as number) * (cosMl[1] as number) + (cosMl[m - 1] as number) * (sinMl[1] as number);
  }

  const pcup = new Array<number>(NCOEFF).fill(0);
  const dpcup = new Array<number>(NCOEFF).fill(0);
  pcup[0] = 1;
  const x = sinGc;
  const z = cosGc;

  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      if (n === m) {
        const i1 = idx(n - 1, m - 1);
        pcup[i] = z * (pcup[i1] as number);
        dpcup[i] = z * (dpcup[i1] as number) + x * (pcup[i1] as number);
      } else if (n === 1 && m === 0) {
        pcup[i] = x * (pcup[0] as number);
        dpcup[i] = x * (dpcup[0] as number) - z * (pcup[0] as number);
      } else {
        const i2 = idx(n - 1, m);
        if (m > n - 2) {
          pcup[i] = x * (pcup[i2] as number);
          dpcup[i] = x * (dpcup[i2] as number) - z * (pcup[i2] as number);
        } else {
          const i1 = idx(n - 2, m);
          const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
          pcup[i] = x * (pcup[i2] as number) - k * (pcup[i1] as number);
          dpcup[i] = x * (dpcup[i2] as number) - z * (pcup[i2] as number) - k * (dpcup[i1] as number);
        }
      }
    }
  }

  const sqn = new Array<number>(NCOEFF).fill(0);
  sqn[0] = 1;
  for (let n = 1; n <= NMAX; n++) {
    sqn[idx(n, 0)] = (sqn[idx(n - 1, 0)] as number) * ((2 * n - 1) / n);
    for (let m = 1; m <= n; m++) {
      sqn[idx(n, m)] =
        (sqn[idx(n, m - 1)] as number) * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }
  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      pcup[i] *= sqn[i] as number;
      dpcup[i] = -(dpcup[i] as number) * (sqn[i] as number);
    }
  }

  let bx = 0;
  let by = 0;
  let bz = 0;
  for (let n = 1; n <= NMAX; n++) {
    for (let m = 0; m <= n; m++) {
      const i = idx(n, m);
      const cosm = cosMl[m] as number;
      const sinm = sinMl[m] as number;
      const gcos = (g[i] as number) * cosm + (h[i] as number) * sinm;
      const gsin = (g[i] as number) * sinm - (h[i] as number) * cosm;
      const rrn = rr[n] as number;
      bz -= rrn * (n + 1) * gcos * (pcup[i] as number);
      by += rrn * m * gsin * (pcup[i] as number);
      bx -= rrn * gcos * (dpcup[i] as number);
    }
  }
  if (Math.abs(cosGc) > 1e-10) by /= cosGc;

  const psi = gcLat - latRad;
  const bxGeo = bx * Math.cos(psi) - bz * Math.sin(psi);
  const decl = (Math.atan2(by, bxGeo) * 180) / Math.PI;
  if (!Number.isFinite(decl)) return 0;
  return decl;
}

export function trueHeadingFromMagnetic(magneticHeading: number, declination: number) {
  return ((magneticHeading + declination) % 360 + 360) % 360;
}
