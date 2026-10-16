# 02: Kotlin rules engine passing the shared fixtures

**What to build:** a pure-JVM `engine` module whose `build()` returns output identical to the TS v2 engine for every shared fixture and PRNG vector.

**Blocked by:** v2-web/01

**Status:** done (fixture mutation check: changing 15-manual-order expected.stats.total broke both suites, 2026-10-17)

**Glossary:** Original song, Rule copy, Manual order, Bench, Seed. **ADRs:** 0027–0031.

**Files**
- `apps/android/engine/build.gradle.kts` (kotlin-jvm, kotlinx-serialization, JUnit 5); `sourceSets.test.resources.srcDir("../../../packages/rules-engine/fixtures")`.
- `engine/src/main/kotlin/com/rulemix/engine/Types.kt`: `@Serializable` data classes mirroring the TS types 1:1 (`MixRuleInput`, `SourceItem?`, `BuildInput`, `GraphNode`, `BuildIssue`, `BuildStats`, `BuildResult`), JSON field names identical.
- `engine/src/main/kotlin/com/rulemix/engine/Prng.kt`: `fun mulberry32(seed: Long): () -> Double`, `fun <T> seededShuffle(items: List<T>, seed: Long): List<T>` using `Int` arithmetic that matches `Math.imul` and `>>> 0`.
- `engine/src/main/kotlin/com/rulemix/engine/Build.kt`: `fun build(input: BuildInput): BuildResult` (same validation messages not required; same exceptions class `IllegalArgumentException`).
- `engine/src/test/kotlin/.../FixturesTest.kt` (parameterised over every `NN-*.json`, deep equality of the decoded `BuildResult`), `PrngTest.kt` (prng.json).

**Acceptance criteria**
- [ ] `./gradlew :engine:test` passes every fixture and PRNG vector; the test fails if the fixture count differs from the TS suite's.
- [ ] Changing any expected value in a fixture breaks both TS and Kotlin suites (checked once manually, noted in PR).
