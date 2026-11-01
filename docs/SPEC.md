# Dobsonian Equatorial Platform Calculator — Specification

Status: **draft specification. No application code is part of this change.**

## 1. Purpose

A browser app that, given a Dobsonian telescope's dimensions/weights and the observer's latitude, computes the geometry of a circular-segment equatorial platform and shows it in 3D. Outputs:

- Overall platform dimensions
- North pivot / north bearing geometry
- Circular segment (north and south bearing) measurements, suitable for marking out plywood
- Optional drive dimensions (spindle / worm gear)
- Interactive 3D representation

## 2. Tech stack

- Angular (standalone components, signals, current stable)
- Angular Material (forms, layout, tabs, tables)
- three.js for the 3D view (wrapped in an Angular component; no `@angular/*` three wrappers required)
- Calculation logic is a **pure TypeScript module with no Angular or three.js dependency**, unit-testable in isolation (Jest or Karma, whichever the Angular CLI default provides).
- Client-side only; no backend.

## 3. Sources

The maths comes from two guides. Where they differ, §4 follows the Sky at Night spreadsheet because it is a complete, checkable formula set.

1. BBC Sky at Night Magazine, *Build a Dobsonian equatorial platform* (Mark Parrish) — https://www.skyatnightmagazine.com/advice/build-a-dobsonian-equatorial-platform. Provides the "Geometry and calculations" PDF and an `.xlsx` calculator. The formulas in §4 were read from that spreadsheet.
2. Optical Ed's, *Making an Equatorial Platform* — https://opticaleds.com/custom-made-equatorial-platforms/. Supplies the centre-of-gravity method, the bearing chord check, and the synchronous-motor north radius formula (§6).

**Verification of the formulas:** with the spreadsheet's default inputs, the formulas in §4 reproduce every output of the spreadsheet (e.g. G = 454.238 mm, H = 597.746 mm, North radius = 462.744 mm). These defaults become the first unit-test fixture (§9).

## 4. Calculation model

Units: millimetres, kilograms, degrees. Trig functions take radians internally. The letters match the Sky at Night geometry diagram.

### 4.1 Inputs

| Sym | Input | Unit | Default | Notes |
|---|---|---|---|---|
| α | Latitude | ° | 50.7279 | Use absolute value (see §8). Valid range 1–89. |
| A | Weight of scope (OTA) | kg | 11.6 | |
| B | Height of OTA centre of gravity above ground | mm | 640 | Centre of the altitude bearings |
| C | Weight of mount / rocker box | kg | 9.4 | |
| D | Height of mount / box centre of gravity above ground | mm | 225 | Found by balancing the box on its side |
| E | Width of mount base board (ground-board feet) | mm | 330 | |
| F | Platform thickness (gap for the segments) | mm | 75 | Default 75, user-adjustable |

### 4.2 Core geometry

```
G  = (A·B + C·D) / (A + C)              combined C of G height above ground
H  = (G + F) / tan(α) + E/2             distance from origin to north bearing
J  = H − E                              distance from origin to south bearing
I  = H · sin(α)                         radius of north bearing
K  = J · sin(α)                         radius of south bearing
L  = F / cos(α)                         height (radial thickness) of the segments
M  = I − L                              polar axis to platform (north bearing plane)
N  = 2 · atan((E/2) / I)  (in degrees)  angle of north segment below the platform
O  = N + 22.5°                          angle of segment including travel extensions
P  = 2 · I · sin(O/2) + 30              chord length of north segment
Q  = 2 · K · sin(O/2) + 30              chord length of south segment
```

Notes:
- The "origin" is the point on the line marking the bottom of the mount (top of the platform) where the polar axis, drawn at angle α, crosses it. The geometry is a side-view construction; the combined C of G sits on the polar axis. See the Sky at Night geometry diagram.
- N is the angle subtended by the mount base width at the north radius. O adds 22.5° (≈ 1.5 h of sidereal travel at 15°/h) of extension. Make the 22.5° a configurable "extra tracking travel" parameter, defaulting to 22.5°.
- The `+ 30` in P and Q is a 30 mm allowance added by the source spreadsheet to the chord. Make it a configurable "chord margin", default 30 mm.
- The spreadsheet's name for L is "height of North bearing segment" and for M is "polar axis to platform (north bearing plane)".

### 4.3 Reference output (defaults above)

```
G 454.238   H 597.746   J 267.746
I 462.744   K 207.275   L 118.483   M 344.262
N 39.249°   O 61.749°   P 504.925   Q 242.731
```

### 4.4 Sanity checks (Optical Ed's guide)

Shown as non-blocking warnings:

1. **Bearing chord vs. height.** For a given chord `c` and radius `R`, the sagitta is `R − sqrt(R² − (c/2)²)`. Show this for both segments so the user knows the stock board depth needed.
2. **Platform width.** The platform must be wide enough for the ground-board feet plus roughly one hour of travel each side. Rule of thumb from the source: at least `E` plus about `I/4`. Show the recommended minimum top-board width.
3. **Tracking duration.** Total travel time = `O / 15.04°/h` (sidereal). Display it.
4. **Low latitude.** Warn when α < ~10°, where H and the radii become very large.

## 5. Outputs

Grouped in Material cards/tabs, each with a copy-to-clipboard button.

1. **Platform dimensions** — H, J, E, F, recommended top-board width, tracking time.
2. **North pivot / north bearing** — radius I, segment angle N/O, chord P, segment height L, polar axis to platform M, distance from origin H.
3. **Circular segments** — table for North and South: radius, chord length, angle, thickness, sagitta, distance from origin. Each segment also gets a 2D marking-out sketch (SVG) showing radius, chord, arc angle and centre of curvature.
4. **Drive (optional section)** — see §6.
5. **3D view** — see §7.

## 6. Optional drive calculations

### 6.1 Worm drive (Sky at Night spreadsheet)

Inputs: spindle/gear diameter `R_s` (mm, default 12.5), motor output speed `S` (rpm, default 3).

```
required_spindle_rpm = (2π · I / (24·60)) / (π · R_s)        # mm/min of the north arc ÷ spindle circumference
ideal_ratio          = S / required_spindle_rpm
teeth                = round(ideal_ratio)                      # spur gear tooth count with a single-start worm
```

Defaults give ideal ratio 58.348 and 58 teeth. Note: the spreadsheet uses a 24 h (1440 min) day. A sidereal day is ≈ 1436.07 min. Make this a "sidereal correction" toggle, default **on**. Turning it off gives the spreadsheet's exact numbers, which the unit test fixture uses.

### 6.2 Direct-drive synchronous motor (Optical Ed's)

```
north_radius = (1436 / (60 / motor_rph) · shaft_diameter) / 2
```

Example from the source: 4 rph motor, 12.7 mm shaft → 607.9 mm (the source quotes 0.5 in → 23.93 in). Given a motor rph and shaft diameter, the app can compute this radius and show the difference versus the radius `I` from §4.2 (the source suggests shifting the north bearing slightly forward/back to compensate). Motor rph and shaft diameter are optional inputs.

## 7. 3D representation

A three.js scene in a dedicated Angular component (`PlatformViewerComponent`).

- Elements: ground/base board, bottom plane at thickness F, north and south bearing segments (cylinder sections / extruded arc shapes, radii I and K, angle O, thickness L), top platform board, the mount base board footprint (E), the polar axis as a line, and an indication of the combined C of G on the polar axis.
- A simplified telescope/mount silhouette (box + cylinder) positioned by B, D and E for context. Toggleable.
- The polar axis tilted by α from the horizontal. A compass-style "N" marker for orientation.
- Controls: OrbitControls (rotate/zoom/pan), reset-view button, wireframe toggle, dimension labels toggle.
- Rebuilds geometry reactively when inputs change (debounced ~150 ms). Dispose geometries/materials on rebuild and on destroy.
- Optional animation: slider/play button rotating the platform about the polar axis through the travel angle O, to illustrate tracking.
- Colours come from the Material theme. Support light and dark.

## 8. Open questions / assumptions

- **Southern hemisphere.** The source guides assume the northern hemisphere. Proposed: accept signed latitude, compute with |α|, and mirror the orientation labels ("north bearing" becomes "pole-side bearing" in the south). To be confirmed.
- **Units.** Metric only: mm, kg, degrees. No imperial inputs, outputs or toggle. Figures taken from the imperial source are converted in this spec.
- **Segment shape.** Circular-segment (Sky at Night) design only. The Optical Ed's conical north bearing and the vertical north section are out of scope for v1.
- **Platform weight in C of G.** The Optical Ed's method includes the moving platform's weight in the C of G (a negative height). The Sky at Night method does not. v1 uses the Sky at Night method, with an optional "platform weight / height" input considered for v2.
- **Persistence.** Proposal: save inputs to `localStorage` and encode them in the URL query string for sharing.

## 9. Testing

- Unit tests for the calculation module using the §4.3 reference values (tolerance 1e-6) and the spreadsheet drive values (§6.1).
- Additional cases: α = 0.5, 45, 89; E = 0 (degenerate); A + C = 0 (division guard).
- Component tests for form validation.
- A smoke test that the viewer builds and disposes its scene without errors.

## 10. Proposed application structure

```
src/app/
  core/
    platform-calculator.ts        pure functions (§4, §6)
    platform-calculator.spec.ts
    models.ts                     input / result types
  features/
    inputs-form/                  Material reactive form
    results/                      cards, tables, copy buttons
    marking-sketch/               2D SVG segment sketch
    viewer/                       three.js component
  app.ts
```

## 11. Milestones

1. Scaffold Angular + Material, theme, layout shell.
2. Calculation module + tests (§4, §9).
3. Inputs form and results cards.
4. 3D viewer.
5. 2D marking-out sketch, drive section, URL/localStorage persistence.
6. Polish: warnings, light/dark theme, accessibility, deployment (GitHub Pages).
