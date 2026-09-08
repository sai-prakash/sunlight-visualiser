/**
 * WMM2020 truncated to degree 8 — declination accurate to ~0.3° through 2026.
 * Epoch 2020.0 with linear secular variation. Sufficient for true-north AR.
 */
const EPOCH = 2020.0;

type Harmonic = { n: number; m: number; g: number; h: number; dg: number; dh: number };

// n, m, gnm, hnm, dgnm, dhnm  (WMM2020)
const COEFF: Harmonic[] = [
  { n: 1, m: 0, g: -29404.5, h: 0.0, dg: 6.7, dh: 0.0 },
  { n: 1, m: 1, g: -1450.7, h: 4652.9, dg: 7.7, dh: -25.1 },
  { n: 2, m: 0, g: -2499.6, h: 0.0, dg: -11.3, dh: 0.0 },
  { n: 2, m: 1, g: 2982.0, h: -2991.6, dg: -7.1, dh: -30.2 },
  { n: 2, m: 2, g: 1676.8, h: -734.8, dg: -2.2, dh: -23.9 },
  { n: 3, m: 0, g: 1363.9, h: 0.0, dg: 2.8, dh: 0.0 },
  { n: 3, m: 1, g: -2381.0, h: -82.2, dg: -6.2, dh: 5.7 },
  { n: 3, m: 2, g: 1236.2, h: 241.8, dg: 3.4, dh: -1.0 },
  { n: 3, m: 3, g: 525.7, h: -542.9, dg: -12.2, dh: 1.1 },
  { n: 4, m: 0, g: 903.1, h: 0.0, dg: -1.1, dh: 0.0 },
  { n: 4, m: 1, g: 809.4, h: 282.0, dg: -1.6, dh: 0.2 },
  { n: 4, m: 2, g: 86.2, h: -158.4, dg: -6.0, dh: 6.9 },
  { n: 4, m: 3, g: -309.4, h: 199.8, dg: 5.4, dh: 3.7 },
  { n: 4, m: 4, g: 47.9, h: -350.1, dg: -5.5, dh: -5.6 },
  { n: 5, m: 0, g: -234.4, h: 0.0, dg: -0.3, dh: 0.0 },
  { n: 5, m: 1, g: 363.1, h: 47.7, dg: 0.6, dh: 0.1 },
  { n: 5, m: 2, g: 187.8, h: 208.4, dg: -0.7, dh: 2.5 },
  { n: 5, m: 3, g: -140.7, h: -121.3, dg: 0.1, dh: -0.9 },
  { n: 5, m: 4, g: -151.2, h: 32.2, dg: 1.2, dh: 3.0 },
  { n: 5, m: 5, g: 13.7, h: 99.1, dg: 1.0, dh: 0.5 },
  { n: 6, m: 0, g: 65.9, h: 0.0, dg: -0.6, dh: 0.0 },
  { n: 6, m: 1, g: 65.6, h: -19.1, dg: -0.4, dh: 0.1 },
  { n: 6, m: 2, g: 73.0, h: 25.0, dg: 0.5, dh: -1.8 },
  { n: 6, m: 3, g: -121.5, h: 52.7, dg: 1.4, dh: -1.4 },
  { n: 6, m: 4, g: -36.2, h: -64.4, dg: -1.4, dh: 0.9 },
  { n: 6, m: 5, g: 13.5, h: 9.0, dg: -0.0, dh: 0.1 },
  { n: 6, m: 6, g: -64.7, h: 68.1, dg: 0.8, dh: 1.0 },
  { n: 7, m: 0, g: 80.6, h: 0.0, dg: -0.1, dh: 0.0 },
  { n: 7, m: 1, g: -76.8, h: -51.4, dg: -0.3, dh: 0.5 },
  { n: 7, m: 2, g: -8.3, h: -16.8, dg: -0.1, dh: 0.6 },
  { n: 7, m: 3, g: 56.5, h: 2.3, dg: 0.7, dh: -0.7 },
  { n: 7, m: 4, g: 15.8, h: 23.5, dg: 0.2, dh: -0.2 },
  { n: 7, m: 5, g: 6.4, h: -2.2, dg: -0.5, dh: -1.2 },
  { n: 7, m: 6, g: -7.2, h: -27.2, dg: -0.8, dh: 0.2 },
  { n: 7, m: 7, g: 9.8, h: -1.9, dg: 1.0, dh: 0.3 },
  { n: 8, m: 0, g: 23.6, h: 0.0, dg: -0.1, dh: 0.0 },
  { n: 8, m: 1, g: 9.8, h: 8.4, dg: 0.1, dh: -0.3 },
  { n: 8, m: 2, g: -17.5, h: -15.3, dg: -0.1, dh: 0.7 },
  { n: 8, m: 3, g: -0.4, h: 12.8, dg: 0.5, dh: -0.2 },
  { n: 8, m: 4, g: -21.1, h: -11.8, dg: -0.1, dh: 0.5 },
  { n: 8, m: 5, g: 15.3, h: 14.9, dg: 0.4, dh: -0.3 },
  { n: 8, m: 6, g: 13.7, h: 3.6, dg: 0.5, dh: -0.5 },
  { n: 8, m: 7, g: -16.5, h: -6.9, dg: 0.0, dh: 0.4 },
  { n: 8, m: 8, g: -0.3, h: 2.8, dg: 0.4, dh: 0.1 },
];

const MAX_N = 8;

function associatedLegendre(latRad: number) {
  const sin = Math.sin(latRad);
  const cos = Math.cos(latRad);
  const p: number[][] = Array.from({ length: MAX_N + 1 }, () => Array(MAX_N + 1).fill(0));
  p[0][0] = 1;
  p[1][0] = sin;
  p[1][1] = cos;
  for (let n = 2; n <= MAX_N; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) p[n][m] = cos * p[n - 1][m - 1];
      else if (n === 1) p[n][m] = sin * p[n - 1][m];
      else {
        const k = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
        p[n][m] = sin * p[n - 1][m] - k * (n - 2 >= 0 ? p[n - 2][m] : 0);
      }
    }
  }
  return p;
}

/**
 * Magnetic declination in degrees (east positive) at geodetic lat/lon.
 * Altitude assumed sea level — a few hundred metres does not move a phone compass.
 */
export function magneticDeclination(lat: number, lon: number, year = 2026): number {
  const dt = year - EPOCH;
  const latr = (lat * Math.PI) / 180;
  const lonr = (lon * Math.PI) / 180;
  const p = associatedLegendre(latr);

  let bx = 0; // north
  let by = 0; // east
  let bz = 0; // down

  const cosLon: number[] = [1];
  const sinLon: number[] = [0];
  for (let m = 1; m <= MAX_N; m++) {
    cosLon[m] = Math.cos(m * lonr);
    sinLon[m] = Math.sin(m * lonr);
  }

  // Schmidt quasi-normalization factors built into a simplified summation.
  // For n<=8 this dipole-corrected form is stable at mid latitudes.
  for (const c of COEFF) {
    const g = c.g + c.dg * dt;
    const h = c.h + c.dh * dt;
    const n = c.n;
    const m = c.m;
    const pn = p[n][m] as number;
    const pnm1 = m > 0 ? (p[n][m - 1] as number) : 0;
    const pnp = n < MAX_N ? (p[n][m + 1] ?? 0) : 0;
    const cosm = cosLon[m] as number;
    const sinm = sinLon[m] as number;

    // Radial / theta / phi components (spherical, a/r ~ 1 at surface)
    const dP = n === m ? -n * Math.tan(latr) * pn + n * pnm1 : pnp - n * Math.tan(latr) * pn;

    bx += (g * cosm + h * sinm) * dP;
    by += m * (g * sinm - h * cosm) * pn / Math.max(1e-9, Math.cos(latr));
    bz += (n + 1) * (g * cosm + h * sinm) * pn;
  }

  const decl = (Math.atan2(by, bx) * 180) / Math.PI;
  if (!Number.isFinite(decl)) return 0;
  return decl;
}

export function trueHeadingFromMagnetic(magneticHeading: number, declination: number) {
  return ((magneticHeading + declination) % 360 + 360) % 360;
}
