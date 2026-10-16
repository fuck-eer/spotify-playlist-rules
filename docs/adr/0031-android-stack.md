# ADR-0031: Android stack: Kotlin + Jetpack Compose, ported engine, first-class motion

Status: Accepted (Nishchay, 2026-10-17). Refines ADR-0002.

## Decision

- **Native Kotlin + Jetpack Compose.** Spotify App Remote 0.8.0 + auth 2.1.0 for start-playback and PlayerState (ADR-0026), with the explicit foreground auth and targetSdk-33 workaround proven in the spike.
- **Rules engine ported to Kotlin**, not shared. It must produce output identical to `packages/rules-engine`, including the mulberry32 PRNG and Fisher–Yates shuffle (32-bit int maths must match JS `Math.imul` / `>>>` exactly).
- **Shared JSON fixtures are the contract** (proposal):
  - `packages/rules-engine/fixtures/*.json` (`{ name, input, expected }`, 14 today) stays the single source; the TS suite already runs all of them.
  - Add fixtures for the v2 model (ADR-0027..0030): rules add copies, Manual order, Bench, every-N slot removal, stacked Repeat decrement, Source sync (appended / dropped songs).
  - Add PRNG vectors (`fixtures/prng.json`: seed → first N floats; seed + list → shuffled list) so the Kotlin PRNG is checked on its own.
  - The Kotlin engine module's JUnit suite reads the same directory (Gradle points at `packages/rules-engine/fixtures`), and CI runs both suites, so a change that breaks either implementation fails the build.
- **Animations are first-class**, not polish. Compose uses the tokens from `designs/DSN-20261016-playlist-rules-v2/motion-spec.md`, kept in one Kotlin `Motion` object:
  - `spring.snap`: `spring(dampingRatio = 0.82f, stiffness = 600f)` for layout moves and reflow.
  - `spring.pop`: `spring(dampingRatio = 0.71f, stiffness = 800f)` for cover pop, lift and settle.
  - `spring.sheet`: `spring(dampingRatio = 0.94f, stiffness = 500f)` for bottom sheets.
  - `ease.out`: `tween(240, easing = CubicBezierEasing(.2f, .8f, .2f, 1f))` for opacity, colour, wire and rows.
  - The motion spec's per-interaction table (wire draw-in, cover pop, drag lift/move/drop, Bench) is the reference.

## Consequences

- Two engine implementations to keep in sync; the fixtures turn drift into a test failure.
- Compose springs match the web Framer Motion values one-to-one.
