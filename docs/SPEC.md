# Dobsonian Equatorial Platform Calculator — Specification

Status: **draft specification. No application code is part of this change.**

## 1. Purpose

A browser app that, given a Dobsonian telescope's dimensions/weights and the observer's latitude, computes the geometry of a circular-segment equatorial platform and shows it in 3D. Outputs:

- Overall platform dimensions
- North pivot / north bearing geometry
- Circular segment (north bearing) measurements and south pivot position, suitable for marking out plywood
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
| E | Width of mount base board (ground-board feet) | mm | 330 | The diameter for a round base, which is the usual case. |
| F | Platform thickness (gap for the segments) | mm | 75 | Default 75, user-adjustable. Ground to the top surface of the top board. |

### 4.2 Core geometry

**Design.** This follows Reiner Vogel's circle-segment platform: one circle segment under the north end of the platform, and a simple pivot (a bolt with washers) at the south end. The pivot sits on the polar axis where it crosses the platform plane, so the platform turns about the polar axis. The three support points are the north segment (two contact points on the segment ends of travel) and the south pivot. An earlier version of this spec used two segments (north and south) from the Sky at Night article; that has been replaced.

```
G  = (A·B + C·D) / (A + C)              combined C of G height above ground
H  = (G + F) / tan(α) + E/2             distance from origin to north bearing
I  = H · sin(α)                         radius of north bearing
L  = F / cos(α)                         height (radial thickness) of the segments
M  = I − L                              polar axis to platform (north bearing plane)
N  = 2 · atan((E/2) / I)  (in degrees)  angle of north segment below the platform
O  = N + 22.5°                          angle of segment including travel extensions
P  = 2 · I · sin(O/2) + 30              chord length of north segment
S  = F / tan(α)                         distance from origin to the south pivot
T  = H − S                              south pivot to north bearing
Split (m = unused middle, default 25 %, travel = extra tracking travel):
     outer angle = O/2 = N/2 + travel/2         (each side of the centre line)
     inner angle = min(m · O/2, max(0, (N − travel)/2))
     two mirrored end pieces, each from the inner to the outer angle
Template (t = top-board thickness, default 18 mm):
     flat edge   = M + t / cos(α)               distance from the axis to the underside of the top board
     piece width = I · (sin(O/2) − sin(inner))  (2 · I · sin(O/2) for one whole segment)
     board depth = I · cos(inner) − flat edge   height of the piece, the stock depth needed
```

Notes:
- The "origin" is the point on the line marking the bottom of the mount (top of the platform) where the polar axis, drawn at angle α, crosses it. The geometry is a side-view construction; the combined C of G sits on the polar axis. See the Sky at Night geometry diagram.
- N is the angle subtended by the mount base width at the north radius. O adds 22.5° (≈ 1.5 h of sidereal travel at 15°/h) of extension. Make the 22.5° a configurable "extra tracking travel" parameter, defaulting to 22.5°, range 0–60°.
- The `+ 30` in P is a 30 mm allowance added by the source spreadsheet to the chord. Make it a configurable "chord margin", default 30 mm.
- **Split segment.** Only the ends of the arc touch the rollers or pads, so the middle is left out and the segment becomes two identical pieces, one the mirror of the other (Vogel). "Unused middle" is an advanced option, default 25 %, range 0–80 %; 0 keeps one whole segment.
- **Pieces must cover the travel.** A roller sits under each end of the mount base, at N/2 from the centre line, and rolls over ±travel/2 as the platform turns. So each piece must reach from N/2 − travel/2 to N/2 + travel/2 = O/2. The unused middle is an upper limit: the inner angle is reduced to (N − travel)/2 when the requested gap is larger, and the segment stays whole when travel ≥ N. With the defaults the largest possible gap is (N − travel)/O = 27.1 %, so the earlier one-third default left each piece 1.9° short of the travel.
- **Top board.** The segment hangs from the underside of the top board, so its flat edge is t / cos α further from the axis than the platform top (M). "Top-board thickness" is an advanced option, default 18 mm, and must be less than F. With t = 0 the flat edge is at M, as in the spreadsheet.
- The spreadsheet's name for L is "height of North bearing segment" and for M is "polar axis to platform (north bearing plane)".

### 4.3 Reference output (defaults above)

```
G 454.238   H 597.746   S 61.326   T 536.420
I 462.744   L 118.483   M 344.262
N 39.249°   O 61.749°   P 504.925
```

### 4.4 Sanity checks (Optical Ed's guide)

Shown as non-blocking warnings:

1. **Bearing chord vs. height.** For a given chord `c` and radius `R`, the sagitta is `R − sqrt(R² − (c/2)²)`. Show it for the chord P. It is not the board depth: the flat edge sits on the platform plane, above the chord, so the stock depth needed is the template's board depth (§4.2), which is shown as well.
2. **Platform width.** The platform must be wide enough for the ground-board feet plus roughly one hour of travel each side, and for the segment it carries. Recommended minimum top-board width = max(`E + I/4`, `P`).
3. **Tracking duration.** Total travel time = `extra tracking travel / 15.04°/h` (sidereal); 22.5° gives about 1.5 h. (O includes N, which is the width of the mount base, not travel.) Display it.
4. **Low latitude.** Warn when α < ~10°, where H and the radii become very large.
5. **Segment cannot be built.** Show an error, and offer no template or plan, when M ≤ 0 (the polar axis is below the platform, at high latitudes or with a very thick platform) or when the arc ends do not reach below the flat edge (`I · cos(O/2) ≤ flat edge`).

### 4.5 Board outline and rollers

Dobsonian bases are usually round, so the top board does not have to be a rectangle. The top board and the ground board are cut to one outline, seen from above. It is the convex hull of:

- a straight pole edge as long as the chord P, on the pole side of the segment and of the bearing contact (at least 20 mm past them);
- an arc round the mount, diameter `E + I/4` (the recommended minimum width of §4.4.2: the round base plus its travel), centred under the mount at `H − E/2` from the origin;
- a rounded nose of radius 60 mm round the pivot;
- 25 mm round each roller.

The result is wide at the pole end and tapers to the pivot. Lengths on the drawing are measured from the straight pole edge and widths from the centre line.

The arc runs on two rollers on the ground board, one each side, where the arc is at ±N/2 from its centre line with the platform in the middle of its travel (under the edges of the mount base). In the segment plane (§7 axes) a roller is at `(a, b) = (±I·sin(N/2), −I·cos(N/2))`, which is `I·cos α·(1 − cos(N/2))` above the ground board. The roller axles are parallel to the polar axis.

**Free and drive roller.** One roller runs free; the other is turned by the motor. Their diameters are advanced options: free roller default 22 mm (a 608 bearing), drive roller default 12.5 mm (the drive section's default spindle; use the same value in both places). The free roller is on the +x side (west in the northern hemisphere, east in the southern), the drive roller on the other. Each roller turns in the segment plane, so its axle centre is one roller radius r outside the arc, on the line from the polar axis through the contact point: `axle = contact + r · n`, with n the unit vector from the polar axis out through the contact, and the axle is `I + r` from the polar axis. The drawing gives each axle's height above the ground board, its distance from the centre line and from the pole edge. A roller's lowest point is `axle height − r · cos α`; when that is below the ground-board top, the drawing asks for a recess of that depth.

## 5. Outputs

Grouped in Material cards/tabs, each with a copy-to-clipboard button.

1. **Platform dimensions** — H, S, T, E, F, recommended top-board width, tracking time.
2. **North pivot / north bearing** — radius I, segment angle N/O, chord P, segment height L, polar axis to platform M, distance from origin H.
3. **Circular segments** (the whole arc, for reference) — table for the north segment: radius, chord length, angle, thickness, sagitta, distance from origin. The segment also gets a 2D marking-out sketch (SVG) showing radius, chord, arc angle and centre of curvature.
4. **Plans and downloads**, all SVG, each with a download button:
   - a 1:1 template of one end piece (its flat edge goes against the underside of the top board) (cut two, flip the template for the second; one whole segment when no middle is left out);
   - a **dimensioned drawing** of the platform and its base on an A3 landscape sheet, drawn at the largest standard scale that fits (1:1, 1:2, 1:2.5, 1:4, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100), so a print at 100 % keeps that scale. It has a front view (from the pivot end), a side view and a plan, with dimension lines for the outline (length, width, straight pole edge, arc radii and centres), the platform height F, board thicknesses, the pivot position, T, and the roller spacing; a table of measurements (board outline, pivot, mount base, segment radius and pieces, roller positions and contact height, free and drive roller axles, tracking); a 1:1 detail of the free and the drive roller seen along the polar axis, touching the arc, with the axle distance I + r and the heights; and a title block (project, title with latitude, size, scale, units, date, sheet). Measurements are in mm to 0.1;
   - a 1:1 board template of the outline (§4.5), with the pivot, the mount base, the segment pieces (top board) and the rollers (ground board) marked.
   Piece positions in the plan are projected from the tilted segment plane.
5. **Drive (optional section)** — see §6.
6. **3D view** — see §7.

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

Example from the source: 4 rph motor, 12.7 mm shaft → 607.9 mm (the source quotes 0.5 in → 23.93 in). Given a motor rph and shaft diameter, the app can compute this radius and show the difference versus the radius `I` from §4.2 (the source suggests shifting the north bearing slightly forward/back to compensate). Motor rph and shaft diameter are optional inputs. The sidereal-correction toggle from §6.1 applies here too: off uses a 1440 min day instead of 1436.

## 7. 3D representation

A three.js scene in a dedicated Angular component (`PlatformViewerComponent`).

- Elements: ground/base board and top board cut to the outline of §4.5, bottom plane at thickness F, the north bearing segment as two mirrored end pieces (cylinder sections / extruded arc shapes, radius I, angle O, thickness L), the south pivot bolt, the free and drive rollers (axles along the polar axis), top platform board, the mount base board footprint (E), the polar axis as a line, and an indication of the combined C of G on the polar axis.
- A simplified telescope/mount silhouette (box + cylinder) positioned by B, D and E for context. Toggleable.
- The polar axis tilted by α from the horizontal. A compass-style "N" marker for orientation.
- Controls: OrbitControls (rotate/zoom/pan), reset-view button, wireframe toggle, dimension labels toggle.
- Lettered measurements: with the dimension labels on, every lettered value of §4.1–4.2 is drawn as a line over what it measures, labelled with its letter and value: E across the mount base, F (ground to platform top), G (platform top to the combined C of G), H, S and T along the ground beside the platform, and in the segment plane M (axis to platform plane) and L (platform plane to ground) down the centre line, I out to the end of the arc, N and O as angles, and P as the chord. They are shown with the platform in the middle of its travel.
- Rebuilds geometry reactively when inputs change (debounced ~150 ms). Dispose geometries/materials on rebuild and on destroy.
- Optional animation: slider/play button rotating the platform about the polar axis through ±travel/2 (not O, which includes N), turning against the Earth's rotation, to illustrate tracking.
- Axes: right-handed like three.js, y up, z towards the visible celestial pole, so x is west in the northern hemisphere and east in the southern.
- Colours come from the Material theme. The app is light mode only; there is no dark mode.

## 8. Open questions / assumptions

- **Southern hemisphere.** The source guides assume the northern hemisphere. Signed latitude is accepted and the geometry uses |α|. In the south the bearing and segment are named "south" and the pivot "north" (results, template, plan, 3D markers), and the tracking animation turns the other way.
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

Coding conventions are in [development/angular-development.md](development/angular-development.md).

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
6. Polish: warnings, light theme, accessibility, deployment (GitHub Pages).
