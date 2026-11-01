---
name: dobsonian-eq-angular-development
description: Rules and conventions for working on the Dobsonian EQ platform calculator Angular app. Covers generating items with the Angular CLI, component files, Angular Material, the pure calculation module, the three.js viewer, forms, routing, and testing.
metadata:
  adapted-from: https://github.com/KristijanJankuloski/cerbo/blob/master/docs/development/angular-development.md
---

# Angular Development Guidelines

Read this before creating or changing anything in the Angular app. It is adapted from the Cerbo guidelines. Taiga UI, Tailwind, ngrx signals, i18n, HTTP/session and API rules are dropped because this app has none of them (it is client-only, English, metric). Material and three.js rules are added.

The app does not exist yet; see [docs/SPEC.md](../SPEC.md). Where this file says "once scaffolded", confirm against the real project and update this file in the same PR.

1. Look at the project before giving guidance: Angular version, `package.json`, `angular.json`, test runner. Match the code that is already there. Use whatever `ng new` generates for the current stable Angular (standalone, zoneless where it is the default, the default test runner) unless this file says otherwise.
2. **Create every new Angular item with `npx ng generate` first.** Never write the files by hand if the generator can make them. If it cannot (a route entry, a model, a pure function file), say so and write only that part by hand. Use `--dry-run` to check paths before generating.
3. After generating or changing code, run `npx ng build` and fix every error before going on, then `npx ng test --watch=false`.
4. Follow the rules below.

## Project rules

- **Metric only.** mm, kg, degrees. No imperial inputs, outputs or toggles. Name variables and fields with their unit where it is not obvious (`radiusMm`, `latitudeDeg`, `massKg`).
- **Separate files.** A component has its own template (`templateUrl`) and, when it has styles, its own stylesheet (`styleUrl`). Never an inline `template:` or `styles:`. Keep the shape `ng generate component` writes.
- **Angular Material controls only.** Use Material's form field, input, button, select, slide toggle, tabs, card, table, tooltip, snack bar and so on. Do not build custom input elements.
- **Common UI goes through wrappers in `src/app/shared/components/`** (for example a numeric field with label, unit suffix and error text). Feature pages do not repeat `mat-form-field` boilerplate; they use the wrapper.
- **Calculations are pure TypeScript.** Everything in SPEC §4 and §6 lives in `src/app/core/calculator/` as plain functions and types with no Angular, RxJS, DOM or three.js imports. Components call it; they never contain formulas.
- **three.js is isolated.** Only `features/viewer/` imports `three`. The viewer receives a calculation result as an input and knows nothing about forms.
- **A feature is self-contained.** Everything that belongs to one feature lives in `src/app/features/<area>/`: components, models, services, and a routes file if the feature has routes.
- **Local first, promote on reuse.** Something used by one feature is created inside that feature's folder. When a second feature needs it, move it to `shared/` and import it from there. A feature never imports from another feature's folder.

## Project layout

| Path                       | What goes there                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/app/core/calculator/` | The pure calculation module and its models/types, plus specs. No framework imports.                               |
| `src/app/core/` (other)    | App-wide wiring only: providers, theme setup, the layout shell.                                                   |
| `src/app/shared/`          | `components/` (Material wrappers), `services/`, `models/`, `pipes/`, `validators/` used by more than one feature. |
| `src/app/features/<area>/` | One self-contained folder per feature: `inputs-form/`, `results/`, `marking-sketch/`, `viewer/` (see SPEC §10).   |
| `src/testing/`             | Test helpers.                                                                                                     |

Path aliases (`tsconfig.json`): `@core/*`, `@shared/*`. Use them across folders; use relative imports inside one folder.

## Creating new items

Run from the project root. Confirm paths with `--dry-run` the first time.

| Item                         | Command                                                           | Creates                                                                                  |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Component                    | `npx ng g c features/<area>/<name>` or `shared/components/<name>` | `.ts`, `.html`, `.css`, `.spec.ts`                                                       |
| Service                      | `npx ng g s shared/services/<name>` (or inside the feature)       | `.ts`, `.spec.ts`                                                                        |
| Pipe                         | `npx ng g p shared/pipes/<name>`                                  | `.ts`, `.spec.ts`                                                                        |
| Directive                    | `npx ng g d shared/<name>`                                        | `.ts`, `.spec.ts`                                                                        |
| Calculator functions, models | none                                                              | write `core/calculator/<name>.ts` and its spec by hand, and say that no generator exists |

- Use `ng add` instead of `npm install` for Angular libraries (`@angular/material`). three.js is a plain `npm install three` plus `@types/three`.
- If a dev server is running, restart it after adding files by hand; its watcher can cache "template file not found".

## Components

- Standalone is the default; do not set the flag. List what the template uses in `imports`.
- Selector prefix is `app-`. Class names follow what the generator writes (suffixless: `Results`, not `ResultsComponent`). Do not mix suffixed and suffixless names in one folder.
- Use signal `input()`, `output()`, `model()`; `computed` for derived values; `inject()` for dependencies.
- Use `@if`, `@for` (always with `track`), `@switch`. Self-closing tags for components with no projected content.
- Call methods directly in event bindings: `(click)="reset()"`.
- Custom CSS goes in the component's own stylesheet and uses Material system tokens (`var(--mat-sys-...)`), not hard-coded colours, so light and dark themes both work.
- Derive results with `computed()` from the form value signal; do not recompute in templates or store the result in a second writable signal.

## Angular Material

- Set up with `npx ng add @angular/material`. One theme file, light and dark via `color-scheme`, following the system preference.
- Every control sits in a `mat-form-field` with a `mat-label`. Units are shown with a `matSuffix` (`mm`, `kg`, `°`). Validation messages use `mat-error`.
- Numeric fields use `type="number"` with `min`, `max`, `step`. The limits come from SPEC §4.1 (for example latitude 1 to 89).
- Group outputs in `mat-card` or `mat-tab-group` as SPEC §5 lays out. Tabular data uses `mat-table` or plain semantic `<table>` with Material typography; pick one and stay with it.
- Copy-to-clipboard confirmations use `MatSnackBar`.
- Icons only from Material Symbols, with an `aria-label` on icon-only buttons.

## Forms

- **Reactive forms** for every form (typed `FormGroup`). Do not introduce Signal Forms or template-driven forms.
- Bridge to signals with `toSignal(form.valueChanges, { initialValue: form.getRawValue() })` and compute results from that. Only compute when the form is valid.
- Debounce ~150 ms before rebuilding the 3D scene (not before updating the numbers).
- Persist inputs to `localStorage` and the URL query string as SPEC §8 proposes. Treat both as untrusted: parse, clamp to the same limits as the form, and fall back to defaults. Never `eval` or inject them into HTML.

## three.js viewer

- The viewer component owns the renderer, scene, camera, and `OrbitControls`. Create them in `afterNextRender`, never during construction, so server-side or test environments do not touch WebGL.
- Run the render loop outside Angular's change detection (`NgZone.runOutsideAngular` where zones exist; otherwise just `requestAnimationFrame` and no signal writes per frame). Render on demand (on control change or input change) rather than continuously, unless the tracking animation is playing.
- Rebuild geometry from the calculation result in one place. Dispose of every geometry, material and texture you replace, and of the renderer on destroy (`DestroyRef.onDestroy`). Cancel the animation frame and disconnect the `ResizeObserver`.
- Size the canvas from its container with a `ResizeObserver`, set pixel ratio to `min(devicePixelRatio, 2)`.
- Scene units are millimetres. Keep the polar axis, north direction and handedness identical to SPEC §7, and put axis conventions in a comment at the top of the scene builder.
- Build scene objects with small pure builder functions (`buildSegment(radiusMm, angleDeg, thicknessMm)`), so geometry maths can be unit tested without WebGL.
- Take colours from the Material theme via CSS variables, read when the scene is built and on theme change.

## Routing

- The v1 app is a single page. If routes are added later, each feature registers its own `<area>.routes.ts` (exporting `<area>Routes: Routes`), and `app.routes.ts` lazy-loads them with `loadChildren`; pages lazy-load with `loadComponent`.
- Routes files get no specs; cover routing in `app.routes.spec.ts`.
- Query parameters (shared input state) are attacker-controlled: validate them as above.

## Testing

- Use the test runner `ng new` set up; run `npx ng test --watch=false`, or `--include "src/app/<path>/*.spec.ts"` for part of it.
- **Calculator specs come first.** The reference values in SPEC §4.3 and §6.1 are the base fixture (tolerance 1e-6). Add edge cases from SPEC §9. Tests are written to fail before the code exists.
- If the app is zoneless, state changes render asynchronously: act, `await fixture.whenStable()`, then assert. For plain promise chains use the runner's wait helper (`vi.waitFor` under Vitest).
- **Do not call `fixture.detectChanges()`** (or `markForCheck()`) to force a refresh. Create the component, `await fixture.whenStable()`, and change state through signals, inputs, form controls or DOM events.
- Prefer driving the UI through DOM events and asserting on rendered output. Test ids are `data-testid` attributes, passed through wrapper components' `testId` input.
- Viewer: do not test pixels. Test the pure builders, and a smoke test that the component creates and destroys its scene without throwing. Stub WebGL (jsdom has none); mock `WebGLRenderer` rather than running it.
- Routes files do not need tests.

## Accessibility and mobile

- Landmarks and headings: one `<h1>` in the banner, `<main id="main">`, card titles as `<h2 mat-card-title>`. Keep the skip link working.
- Every control has a visible label or an `aria-label`. Icon-only and repeated buttons (for example "Copy") get a name that says what they act on.
- Data tables have a `<caption>` (visually hidden is fine) and `scope` on headers.
- Status and empty-state messages use `role="status"`. Do not announce every keystroke.
- Colours come from the Material theme tokens, so contrast holds in light and dark. Do not hard-code colours.
- Layouts must work at 360 px wide with no horizontal scroll. Use `minmax(min(100%, Npx), 1fr)` grids, not fixed widths.
- The 3D view is supplementary: its numbers must also be available as text in the results. Its canvas area is focusable and pans with the arrow keys.
- Before a PR that changes the UI, check it at 360 px and 1200 px, light and dark, and run an axe-core audit (no violations).

## Tooling

- Commands: `npm install`, `npm start`, `npx ng build`, `npx ng test --watch=false`.
- Only one dev server per port. If `npm start` says the port is in use, a stale server is still running: stop it, do not start another.
- Watch the initial bundle size warning. three.js is large: import named exports (`import { Scene, ... } from 'three'`) so tree shaking works, and lazy-load the viewer feature.
- Build and tests must pass before a PR is opened.

## Differences from the Cerbo guidelines

| Topic               | Cerbo                                                                 | This repo                                                       |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| UI library          | Taiga UI 5 + Tailwind                                                 | Angular Material, no Tailwind                                   |
| State               | `@ngrx/signals` stores                                                | Component signals and `computed`; no store unless the app grows |
| HTTP, session, i18n | Cookie session, API, ngx-translate                                    | None: client-only, English, metric                              |
| Extra rules         | Result/AuthError handling                                             | Pure calculator module, isolated three.js viewer                |
| Kept the same       | Separate files, generator-first, reactive forms, no `detectChanges()` | Same                                                            |
