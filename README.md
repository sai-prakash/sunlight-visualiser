# Sunlight Visualiser

A mobile-first, installable web app for inspecting direct sunlight around a property. No build step, JavaScript dependencies, account, or API key. The authored application lives in `dist/`.

## Implemented

- NOAA/Meeus solar position from coordinates, date and explicit UTC offset.
- Interactive 3D diagram and true-north floor plan. Draw rectangular open spaces and enter measured dimensions and elevations.
- Ray/box occlusion with independently positioned, elevated blockers. Thin raised boxes model overhangs; split boxes can model walls around window openings.
- Day playback, seasonal shortcuts and a full-year exposure map calculated in a Web Worker.
- Rear-camera sun paths with manual field-of-view, pitch and heading calibration; optional absolute phone compass readings. Red projected boxes represent manually measured blockers.
- Frozen-camera opening annotations show whether the projected sun is inside the rectangle. These are 2D observations, not tracked floor surfaces.
- Video-only walkthrough recording and download, capped at two minutes or approximately 150 MB. No upload or audio.
- Local study persistence, validated JSON import/export, install manifest and offline shell.

## Accuracy contract

This is an initial measured-model web app, **not the completed automatic AR surveying/scanning product**. It does not claim to be the most accurate visualiser.

Solar angles are computed independently from NOAA/Meeus equations. Azimuth is clockwise from true north; longitude is positive east. Ray casting uses **geometric** altitude. Atmospheric refraction, solar disk width, observer parallax, terrain and distant horizon dip are not applied. One NREL SPA reference case is tested with a 0.05-degree tolerance; its reference altitude includes refraction. That test is not an accuracy bound for all dates and locations.

Coordinates are east, north, up in metres above a common local datum. Spaces are horizontal rectangles and blockers are axis-aligned solid boxes. Sun-equivalent hours are the area-weighted integral of direct sun: half the area lit for two hours equals one sun-equivalent hour. Daily summaries sample every 10 minutes at 25 points; yearly maps every 20 minutes at 16 points. The current scene uses 144 points. Sampling can produce differences at shadow boundaries. Daylight uses the solar centre above the geometric horizon, not published refracted sunrise/sunset times.

Time zone is an explicit fixed offset; annual maps do **not** automatically adjust daylight saving. India uses +5.5 throughout the year. Weather, diffuse light, reflections, glazing, trees and unmapped walls/ceilings are not modelled. No solar intensity or lux is calculated.

Camera mode assumes the viewer stands at the selected space centre with the lens 1.6 m above its floor. Hold the phone upright in portrait with no roll. Field of view starts at an uncalibrated 65 degrees. Video is displayed without cropping, at its actual aspect ratio. Compass readings may reference magnetic north; supply a correction and verify a known true bearing. There is no visual-inertial tracking, AR anchoring, automatic blocker segmentation or measured camera depth. Moving away from the observation point invalidates alignment. Do not look directly at the sun to calibrate.

Recording a walkthrough does **not** generate a 3D house model. Native ARKit/ARCore capture or a validated reconstruction pipeline is required for that capability. The UI states this limitation.

## Run and test

Serve `dist/` with a static server. Camera, geolocation and service workers require HTTPS (localhost is suitable for development).

```sh
python3 -m http.server 8080 --directory dist
node --test tests/*.test.js
```

`npm run check` syntax-checks the source. There are no dependencies to install. `vercel.json` selects `dist` as the output directory.

## Device acceptance gate: not yet performed

1. On real iPhone and Android devices, exercise camera/GPS/orientation permission grants, denial and reopening.
2. Calibrate bearing and field of view against two surveyed landmarks; compare angular error at image centre and edges.
3. Measure a balcony and one obstructing building. Compare predicted shadow boundaries and sunlight arrival/departure times with observations at three times of day.
4. Repeat at two floor elevations and document the sensitivity to measurement error.
5. Verify install, offline reload, JSON round trip and playable video download. Backgrounding should stop camera and recording.

## Native/scanning extension

The sun/ray engine can be reused in a native wrapper. A proper scanning phase needs metric world tracking, true-north registration, camera intrinsics, measured mesh capture, aperture modelling, persistent anchors and mesh ray casting. A wrapper alone does not add these. Import/export currently accepts the version-1 rectangle/box schema, not arbitrary meshes.

## Sources

- [NOAA method](https://gml.noaa.gov/grad/solcalc/calcdetails.html)
- [Independent NREL/NLR SPA reference](https://midcdmz.nlr.gov/spa/spa_tester.c)
- [Device orientation](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent)
- [WebXR limits](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
