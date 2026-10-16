# 05: Mix list, create Mix, offline read-only cache

**What to build:** the Mix list from `GET /api/mixes` with New mix (source picker sheet, as web); the last fetched list and Mix states are cached and shown read-only offline with an offline banner.

**Blocked by:** 04, v2-web/02

**Status:** ready-for-agent

**Glossary:** Mix, Source playlist. **ADRs:** 0032. **Design:** android-notes Screens table; inventory.md mobile list.

**Files:** `ui/mixes/MixListScreen.kt`, `ui/mixes/SourcePickerSheet.kt`, `data/MixRepository.kt` (`mixes(): Flow<CachedResult<List<Mix>>>`, `state(id): Flow<CachedResult<MixState>>`), `data/Cache.kt` (JSON files in `filesDir/cache/`), `data/Connectivity.kt`.

**Acceptance criteria**
- [ ] Repository tests: online fetch writes cache; offline returns cache with `stale = true`; no cache offline → empty state `You're offline. Connect to load your mixes.`
- [ ] Compose tests: offline banner; New mix disabled offline.
