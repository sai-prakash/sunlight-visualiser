# Solara

See the sun before you buy. A PWA sunlight visualiser for home buyers: live AR on the camera, a metric 3D site, and a year-round insolation map.

## What it does

- **SPA-grade sun position** — NOAA solar position (azimuth from true north, refraction, observer height).
- **True north** — WMM2020 magnetic declination so phone compass overlays match the sky.
- **Mark a space** — draw the terrace, courtyard, or room.
- **Blockers** — massing boxes with height, plus a traced skyline and surrounding terrain elevation.
- **Red / gold** — cells in the marked space turn red when the sun is cut, gold in direct light.
- **Walk** — drop floor points as you move, then read the same sun against that path.
- **Live AR** — rear camera, device orientation, sun disc and occlusion mask (install the PWA on a phone).
- **Year view** — hours of direct sun for every day, with solstice comparison.

## Stack

TanStack Start, React 19, Tailwind v4, three.js / React Three Fiber, zustand. No account required; sites persist in the browser.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Connect this repo to Vercel. Production build is `npm run build` (Nitro `vercel` preset). Camera and GPS need HTTPS.

Native packaging later: wrap the same PWA with Capacitor (`ios` / `android`) — the AR path already uses `getUserMedia` + `DeviceOrientationEvent`.
