# Solara

See the sun before you buy. A PWA sunlight visualiser for home buyers: satellite map + floor plan, live AR on the camera, a metric 3D site, and a year-round insolation map.

## What it does

- **Map** — Esri satellite, pin the plot, overlay a floor-plan image, draw the balcony or room.
- **Nearby buildings** — OpenStreetMap footprints with height / storeys, plus terrain elevation rings.
- **SPA-grade sun position** — NOAA solar position (azimuth from true north, refraction, observer height).
- **True north** — WMM2025 magnetic declination so phone compass overlays match the sky.
- **Pinhole AR overlay** — full camera matrix (heading / pitch / roll) projects the day’s sun path and god-rays onto the live camera, with red where a blocker cuts the beam.
- **Red / gold** — cells in the marked space turn red when the sun is cut, gold in direct light. A day ribbon shows *when* the space is lit.
- **Year view** — hours of direct sun for every day, with solstice comparison, per marked space.
- **Walk** — drop floor points as you move, then read the same sun against that path.

## Stack

TanStack Start, React 19, Tailwind v4, Leaflet, three.js / React Three Fiber, zustand. No account required; sites persist in the browser.

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Connect this repo to Vercel. Production build is `npm run build` (Nitro `vercel` preset). Camera, GPS, motion, and WebXR need HTTPS.
