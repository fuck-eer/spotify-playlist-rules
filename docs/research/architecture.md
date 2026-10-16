> Exported from Notion: https://app.notion.com/p/3fa425073e24819aaa25e7cd7da6ae3c (fetched 2026-10-16)

# 🎛️ Spotify Playlist Rules: Architecture

<callout icon="🎛️" color="blue_bg">
	Detailed architecture for the **Spotify Playlist Rules** idea. Source plan: <mention-page url="https://app.notion.com/p/3fa425073e24810782c7efdca91fc3f3"/>. Spotify facts were re-checked against [developer.spotify.com](http://developer.spotify.com) on 13 Oct 2026 (sources at the bottom). Diagrams are hand-drawn Excalidraw. Sources are in `/workspace/spotify-rules-diagrams/` on the agent box.
</callout>
<table_of_contents/>
---
## 1. Summary
The app does not play music. It reads a **source** (a playlist you own or collaborate on, or Liked Songs) and applies an ordered list of **rules**: pin first, insert every N, and repeat N times. It writes the result into a private target playlist called **"Rules: \<name\>"**. You play that playlist in the normal Spotify app with shuffle **off**. Rules are applied by a pure, deterministic **rule engine**. A thin **Spotify integration layer** handles OAuth (PKCE), reading with pagination, writing in 100-item chunks, and rate limits. Regeneration is on demand at first. A small **scheduler/server** can add nightly regeneration later.
Constraints that drive the design (all verified, see §10):
- **Development mode**: the app owner needs Premium (the app stops working if it lapses). Up to **5 authenticated users** can be allowlisted. Use is non-commercial. Since July 2026, quotas are counted **per developer account**.
- **Extended quota** (public launch) is only for organizations, with at least 250k MAU. A public launch is effectively out of reach, so we design for personal use and up to 5 users.
- **February 2026 API changes**: playlist endpoints are now `/playlists/{id}/items`. Items can be read only for playlists you own or collaborate on, so other people's and Spotify-made playlists can't be sources. Batch track lookups were removed, and `GET /search` returns at most 10 results.
## 2. System architecture and components
![System context: the app talks to Spotify Accounts (OAuth) and the Web API; you listen in the regular Spotify app with shuffle off.](notion-file-block://1970523a-00db-4733-94aa-c1e46469c1e2/c56fcd23-24c4-49d1-9cd4-e2ae37d084b7?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=01_system_context.png)
<table header-row="true">
<tr>
<td>Component</td>
<td>Responsibility</td>
<td>Does NOT do</td>
</tr>
<tr>
<td>**UI** (single screen in v1)</td>
<td>Pick a source, edit rules (drag order sets priority), preview with conflict badges, Regenerate button and status</td>
<td>Call Spotify directly (it goes through the integration layer)</td>
</tr>
<tr>
<td>**Rule engine**</td>
<td>Pure function `build(base, ruleSet, seed) -> {uris, preview}`, plus `validate(ruleSet)`. Deterministic and side-effect free</td>
<td>Network, storage, clock, randomness without a seed</td>
</tr>
<tr>
<td>**Spotify integration layer**</td>
<td>PKCE auth and token refresh; HTTP client (Bearer, 401 refresh, 429 backoff); readers (pagination); writer (create once, PUT then POST chunks, snapshot_id)</td>
<td>Rule logic</td>
</tr>
<tr>
<td>**Storage**</td>
<td>Rule sets, target playlist id, last snapshot_id, tokens, run log, and a short-lived track-name cache for the preview</td>
<td>Long-term copies of Spotify content (see §8)</td>
</tr>
<tr>
<td>**Scheduler / server** (optional, v2+)</td>
<td>Nightly job: load rule set, refresh token, call the same regenerate use-case</td>
<td>Anything the on-demand path doesn't already do</td>
</tr>
</table>
![Component diagram: the UI, the pure rule engine, storage and the Spotify integration layer, with the optional v2 scheduler reusing the same path.](notion-file-block://b0060044-5121-4570-9942-cce4d54efb80/68fc68f6-ad21-49a7-b3b1-4217cdcbedd6?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=02_components.png)
Key design choice: **one regenerate use-case**, `regenerate(ruleSetId)`, shared by the button and the scheduler. The engine is a separate package, so v0 (script), v1 (UI) and v2 (server) all run the exact same code.
## 3. Spotify integration
### 3.1 Authentication: Authorization Code with PKCE
PKCE is Spotify's recommended flow for apps that can't keep a client secret (browser, mobile, CLI). The flow:
1. Generate a `code_verifier`: a high-entropy random string of 43–128 characters from letters, digits, and `_ . - ~`.
2. Compute `code_challenge = base64url(SHA256(code_verifier))`.
3. Send the user to `GET https://accounts.spotify.com/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge_method=S256` and `code_challenge`.
4. Spotify redirects to `redirect_uri?code=...&state=...`. Verify `state`.
5. Call `POST https://accounts.spotify.com/api/token`, form-encoded, with `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id` and `code_verifier`. No client secret is needed.
6. The response contains `access_token` (`expires_in: 3600`), `refresh_token`, `scope` and `token_type`.
![OAuth 2.0 Authorization Code + PKCE sequence, including the refresh path.](notion-file-block://fb4fd019-9928-496e-a873-cfdd8f987739/7031da93-62cb-4f6f-8db2-27d43a6f3d58?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=03_oauth_pkce.png)
**Redirect URIs.** Use HTTPS, except for loopback addresses: `http://127.0.0.1:PORT/callback` or `http://[::1]:PORT/callback`. The name `localhost` is **not** allowed. For loopback, the port can be dynamic. v0 and v1 use loopback; anything hosted (v2 UI, v3) needs an HTTPS URI registered in the Dashboard.
**Token lifetimes.** Access tokens last **1 hour**. Refresh tokens issued to Dashboard apps last **6 months from authorization**. Refreshing does *not* extend that. After 6 months the user must authorize again. The refresh call is `POST /api/token` with `grant_type=refresh_token`, `refresh_token` and `client_id` (PKCE apps send no secret). The response *may* include a new refresh_token. If it does, store it; if not, keep the old one.
**Token storage per phase.**
- v0 script: a `token.json` file with mode 600, or the OS keychain.
- v1 SPA: access token in memory only. The refresh token goes in IndexedDB or localStorage. That is acceptable for a local-only, single-user tool, but it is exposed to XSS, so ship no third-party scripts and use a strict CSP.
- v2/v3 server: the refresh token is encrypted at rest (key in an env secret or KMS) and never sent to the browser.
- Every phase: store `authorized_at` and warn about two weeks before the 6-month expiry.
**Scopes** (minimal set from the plan):
<table header-row="true">
<tr>
<td>Scope</td>
<td>Needed for</td>
</tr>
<tr>
<td>`playlist-read-private`</td>
<td>List your playlists (`GET /me/playlists`) and read private source playlists</td>
</tr>
<tr>
<td>`playlist-read-collaborative`</td>
<td>Include collaborative playlists as sources</td>
</tr>
<tr>
<td>`playlist-modify-private`</td>
<td>Create and write the private "Rules: \<name\>" playlist</td>
</tr>
<tr>
<td>`user-library-read`</td>
<td>Liked Songs as a source (`GET /me/tracks`)</td>
</tr>
<tr>
<td>`playlist-modify-public` (only if needed)</td>
<td>Only for a public or collaborative target. Leave it out by default</td>
</tr>
</table>
### 3.2 Endpoints used (post-February-2026 names)
<table header-row="true">
<tr>
<td>Purpose</td>
<td>Call</td>
<td>Notes</td>
</tr>
<tr>
<td>List sources</td>
<td>`GET /v1/me/playlists?limit=50&offset=k`</td>
<td>limit max 50. Filter to playlists you own or collaborate on (others can't be read)</td>
</tr>
<tr>
<td>Read playlist source</td>
<td>`GET /v1/playlists/{id}/items?limit=50&offset=k&fields=...`</td>
<td>Formerly `/tracks`; limit max 50. Owner or collaborator only, otherwise **403**. Each entry's `item` field replaces the deprecated `track` field. Use `fields` to fetch only uri, type, is_local, name and artists</td>
</tr>
<tr>
<td>Read Liked Songs</td>
<td>`GET /v1/me/tracks?limit=50&offset=k`</td>
<td>limit max 50; needs user-library-read</td>
</tr>
<tr>
<td>Create target (once)</td>
<td>`POST /v1/me/playlists`</td>
<td>Body: `name`, `public: false`, `description`. Replaces the removed `POST /users/{id}/playlists`. Returns the playlist with `id` and `snapshot_id`. Store the id; don't create a new playlist on every run</td>
</tr>
<tr>
<td>Replace contents</td>
<td>`PUT /v1/playlists/{id}/items` body `{"uris":[...]}`</td>
<td>**max 100 URIs**. Replaces everything; an empty list clears the playlist. Returns `snapshot_id`</td>
</tr>
<tr>
<td>Append chunk</td>
<td>`POST /v1/playlists/{id}/items` body `{"uris":[...]}`</td>
<td>max 100 per request; appends when `position` is omitted. Returns 201 with `snapshot_id`</td>
</tr>
<tr>
<td>Check target version</td>
<td>`GET /v1/playlists/{id}?fields=snapshot_id`</td>
<td>Detects manual edits since the last run</td>
</tr>
</table>
**Pagination.** Loop on `offset` (step 50) until `next` is null. Treat `total` as advisory, because the playlist can change mid-read. Skip entries whose `item` is null, whose `is_local` is true, or whose type is not `track` (podcast episodes), and record them in the preview as "skipped".
### 3.3 Regeneration algorithm
1. Read the whole source (pages of 50) into `base`.
2. `uris = engine.build(base, ruleSet, seed)`.
3. If there's no target id, call `POST /me/playlists` once and store the id.
4. Optional: `GET` the target's snapshot_id. If it differs from the stored one, the user edited "Rules: \<name\>" by hand. Warn that regenerating will overwrite those edits.
5. `PUT /playlists/{id}/items` with `uris[0:100]`. This replaces the playlist, and with an empty list it clears it.
6. For each following chunk of 100, in order: `POST /playlists/{id}/items` with the chunk (append).
7. Store the final `snapshot_id`, plus a run log entry (track count, requests, retries).
![Regeneration sequence: paginate the source, build in the engine, create the target once, PUT the first 100, then POST the remaining chunks.](notion-file-block://d2994fe4-3049-48c0-84cb-54a921cfd66d/fd2df03b-8356-45e2-ade6-ff127b22fa33?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=04_regeneration.png)
**Why PUT then POST?** PUT has two mutually exclusive modes. "Replace" uses `uris` (max 100). "Reorder" uses `range_start`, `insert_before`, `range_length` and optionally `snapshot_id`. So a playlist over 100 items can only be written as one replace followed by appends. Rewriting the whole list is simpler and stateless. A diff that moves items with reorder calls would avoid wiping the playlist, but costs about one request per move. Keep it as a v2+ optimisation if mid-listen jumps turn out to matter (see §9).
**Idempotency and partial failure.** If a run fails after the PUT, the target is left half-written. Because the first call is a full replace, simply **re-running the whole regenerate** converges to the correct state. Never resume halfway with POSTs alone, or you'll duplicate chunks.
**Request budget** (a rough guide): source of S tracks plus output of L tracks costs about `ceil(S/50) + 1 + ceil(L/100)` requests. Liked Songs with 2,000 songs and a 2,100-song output costs about 40 + 1 + 21 = 62 requests. That is fine on demand, but don't regenerate on every edit. The preview runs locally on the cached base.
### 3.4 Rate limits, 429 and error handling
Spotify's rate limit is computed over a **rolling 30-second window**. Exceeding it returns **429** with a `Retry-After` header (seconds). Since July 2026, dev-mode **quota** exhaustion also returns 429 with body `reason: "QUOTA_EXCEEDED"`. Those buckets are shared by all of a developer's Client IDs.
<table header-row="true">
<tr>
<td>Status</td>
<td>Likely cause here</td>
<td>Handling</td>
</tr>
<tr>
<td>429 (rate)</td>
<td>Too many calls in 30 s</td>
<td>Sleep `Retry-After` seconds (plus jitter) and retry the same request. If the header is missing, back off exponentially (1, 2, 4, 8 s, cap 60 s). Requests go out one at a time; no parallel writes</td>
</tr>
<tr>
<td>429 + QUOTA_EXCEEDED</td>
<td>Dev-mode quota bucket used up</td>
<td>Stop the run (don't hammer). Show "quota exceeded, try later"; the scheduler skips to the next night</td>
</tr>
<tr>
<td>401</td>
<td>Access token expired or revoked</td>
<td>Refresh once and retry. If the refresh fails (invalid_grant: 6-month expiry or revoked), mark "re-auth needed"</td>
</tr>
<tr>
<td>403</td>
<td>User not on the allowlist; owner's Premium lapsed; source not owned or collaborative; missing scope</td>
<td>No retry. Show a specific message. Pre-filter sources so the third case doesn't happen</td>
</tr>
<tr>
<td>404</td>
<td>Target playlist deleted or unfollowed by the user</td>
<td>Clear the stored id; ask before recreating</td>
</tr>
<tr>
<td>400</td>
<td>More than 100 URIs, malformed URI, or a bad body</td>
<td>A bug: fail loudly and log the request (no tokens in logs)</td>
</tr>
<tr>
<td>5xx / network</td>
<td>Transient</td>
<td>Up to 3 retries with backoff; then fail the run. Re-run is safe (see idempotency above)</td>
</tr>
</table>
### 3.5 Development-mode limits that matter
- The Client ID owner must have an active **Premium** account, or the app stops working.
- At most **5 authenticated users**, each added by email in the Dashboard. Anyone else gets 403.
- Up to **25 Client IDs per developer** since July 2026 (was 1). Quotas are counted **per developer account**, so a second app doesn't add capacity.
- Extended quota is open only to organizations (May 2025 criteria, including at least 250k MAU). Treat the app as permanently personal.
- `GET /me` no longer returns `email`, `country` or `product`, so the app can't check a user's Premium status. Use `account_id` (added May 2026) as the stable user key instead of `id`.
- Whether *end users* (not the owner) need Premium for dev-mode apps is **not stated in the docs** (open question from the plan).
## 4. Rule engine design
### 4.1 Rule types (v1)
- **Pin first** `pin_first(track)`: the track goes in slot 0.
- **Insert every N** `every_n(track, n)`: the track goes in every N-th slot, at final positions `N, 2N+1, 3N+2, ...` (that is, `k*(N+1)-1`). The count is `floor(B / N)`, where B is the base length after filtering and collision handling. In practice "after every N songs".
- **Repeat N times** `repeat(track, times)`: the track appears `times` times, spread evenly at `floor((i + 0.5) * L / times)` for `i = 0..times-1`.
**Priority = rule order.** Rules are processed top to bottom, and earlier rules claim their slots first. The preview shows for every slot which rule placed it and whether it was *shifted*.
### 4.2 Algorithm
![Rule engine flow: filter, base order, collision policy, counts, slot claiming in priority order with conflict policy, then fill with the base.](notion-file-block://17d7a81a-85d3-45d8-9587-e093f87ebd04/1016ff36-043d-4536-bb44-f756690dabf3?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=05_rule_engine.png)
```typescript
type Rule =
  | { kind: "pin_first"; uri: string }
  | { kind: "every_n";  uri: string; n: number }      // n >= 1
  | { kind: "repeat";   uri: string; times: number }; // times >= 1

interface RuleSet {
  rules: Rule[];                          // order = priority
  baseOrder: "source" | "shuffle";
  collision: "keep" | "remove_from_base";
  conflict: "shift" | "skip" | "error";
}

function build(source: Item[], rs: RuleSet, seed: number) {
  // 1. filter: tracks only, skip null / local / episodes
  let base = source.filter(isPlayableTrack).map(i => i.uri);
  // 2. base order
  if (rs.baseOrder === "shuffle") base = seededShuffle(base, seed); // Fisher-Yates + PRNG(seed)
  // 3. collisions
  if (rs.collision === "remove_from_base") {
    const ruleUris = new Set(rs.rules.map(r => r.uri));
    base = base.filter(u => !ruleUris.has(u));
  }
  // 4. counts -> final length (fixed before any placement)
  const B = base.length;
  const count = (r: Rule) =>
    r.kind === "pin_first" ? 1 : r.kind === "every_n" ? Math.floor(B / r.n) : r.times;
  const L = B + rs.rules.reduce((s, r) => s + count(r), 0);
  // 5. claim slots in priority order
  const slot: (Placed | null)[] = Array(L).fill(null);
  const issues: Issue[] = [];
  rs.rules.forEach((r, ri) => {
    desiredPositions(r, B, L).forEach(p => {
      if (slot[p] === null) { slot[p] = { uri: r.uri, rule: ri }; return; }
      if (rs.conflict === "error") { issues.push({ rule: ri, pos: p, kind: "conflict" }); return; }
      if (rs.conflict === "skip")  { issues.push({ rule: ri, pos: p, kind: "skipped" }); return; }
      const q = nearestFree(slot, p);              // search p+1, p+2, ... then p-1, ...
      slot[q] = { uri: r.uri, rule: ri, shiftedFrom: p };
    });
  });
  // 6. fill the remaining slots with the base, keeping its order
  let b = 0;
  const out = slot.map(s => s ?? { uri: base[b++], rule: null });
  return { uris: out.filter(Boolean).map(s => s.uri), preview: out, issues };
}

function desiredPositions(r: Rule, B: number, L: number): number[] {
  switch (r.kind) {
    case "pin_first": return [0];
    case "every_n":   return range(1, Math.floor(B / r.n)).map(k => k * (r.n + 1) - 1);
    case "repeat":    return range(0, r.times - 1).map(i => Math.floor((i + 0.5) * L / r.times));
  }
}
```
Notes:
- With `skip` or `error`, some rule occurrences go unplaced, so trailing slots stay empty. Trim them (the `filter(Boolean)` above). In `error` mode the UI blocks Regenerate until the conflict is fixed.
- `shift` always succeeds, because total claims equal `L - B`, which is at most `L`.
- `every_n` positions are at most `floor(B/N)*(N+1) - 1`, which is less than or equal to `L - 1`. They are always in range.
- Engine cost is O(L·k) worst case for probing. That is trivial for playlists of thousands of tracks.
- **Worked example** (also in the diagram). Base A..H (B=8); rules 1) pin P, 2) every 3 → X, 3) repeat R ×2. Counts are 1 + 2 + 2, so L = 13. Slots: P@0, X@3, X@7, R wanted 3 so it shifts to 4, R@9. Result: `P A B X R C D X E R F G H`.
### 4.3 Open design decisions (with options)
<table header-row="true">
<tr>
<td>Decision</td>
<td>Options</td>
<td>Recommendation for v1</td>
</tr>
<tr>
<td>**Base order**</td>
<td>(a) keep source order; (b) seeded shuffle, with the seed stored and a "reshuffle" button that changes the seed</td>
<td>Offer both. Default to (b) with a stored seed, so the same rules give a stable result until you press reshuffle</td>
</tr>
<tr>
<td>**Collisions** (a rule song is also in the base)</td>
<td>(a) keep it, so it appears extra times; (b) remove it from the base so only the rules decide where it appears</td>
<td>(b) `remove_from_base`. The result is easier to predict and matches the intent "this song goes here"</td>
</tr>
<tr>
<td>**Conflicts** (two rules want one slot, e.g. pinned + repeated, or two every-N rules)</td>
<td>(a) shift to the nearest free slot; (b) skip; (c) refuse and show an error</td>
<td>(a) shift, flagged in the preview with a "moved from #p" badge. Skip and error stay available</td>
</tr>
<tr>
<td>**Every-N anchor**</td>
<td>(a) every N-th final slot (above); (b) after every N *base* songs, ignoring inserted ones</td>
<td>(a) is simpler to reason about. Revisit after the week-long listening test</td>
</tr>
<tr>
<td>**Repeat spacing**</td>
<td>(a) evenly spaced; (b) back-to-back; (c) min-gap constraint</td>
<td>(a). Keep repeat counts moderate (see §8, artificial manipulation)</td>
</tr>
</table>
### 4.4 Testing
**Unit tests** (vitest/pytest), one per rule kind and edge case:
- Empty base.
- B \< N, so every-N places nothing.
- `times > L`, which validation rejects.
- A pin on an empty base.
- Two pins: the second shifts to slot 1.
- A rule track not present in the source.
- Duplicate source entries.
- Local or null items filtered out.
**Property-based tests** (fast-check for TypeScript, Hypothesis for Python), over random bases (0–3,000 items, with duplicates), random rule lists (0–6 rules) and all policy combinations:
1. **Length**: in shift mode, `len(out) == B + Σ count(r)`.
2. **Conservation**: the multiset of `out` equals base (after collision handling) plus the rule occurrences. Nothing is lost or invented.
3. **Order preservation**: the base items appear in `out` as a subsequence, in base order.
4. **Priority**: if rule 0 is `pin_first`, `out[0]` is its track.
5. **Every-N spacing**: when there are no conflicts, consecutive occurrences of an every-N track are exactly N slots apart.
6. **Determinism**: same inputs and seed give identical output; a different seed changes only the base order (rule positions are unchanged).
7. **Range**: every placed index is between 0 and L-1; there are no empty slots in shift mode.
8. **Preview agrees with output**: `preview.map(p => p.uri)` equals `uris`.
**Integration tests** run against a fake Spotify server with recorded fixtures:
- **Chunking**: the first write is a PUT with at most 100 URIs, the rest are POSTs with at most 100, and the concatenation equals `uris` in order.
- **429**: the client honours `Retry-After` and stops on QUOTA_EXCEEDED.
- **401**: the client refreshes once.
- **Re-run**: after a mid-run failure, a re-run converges.
**Live spike** (plan step 1) on a throwaway playlist checks that duplicate URIs are accepted and kept, and checks what happens when you regenerate while it's playing.
## 5. Data model and storage
![Data model: RuleSet has many Rules and RunLogs; an Account owns RuleSets; TrackCache is short-lived and only feeds the preview.](notion-file-block://65be7498-78a2-475d-a536-4a9a19fea167/1737c6ca-372f-4f60-8513-5eb216c94aad?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=06_data_model.png)
<table header-row="true">
<tr>
<td>Entity</td>
<td>Fields</td>
<td>Notes</td>
</tr>
<tr>
<td>**RuleSet**</td>
<td>id, account_id, name, source (type: playlist or liked; id), target_playlist_id, base_order, shuffle_seed, collision, conflict, last_snapshot_id, last_generated_at, schedule (v2)</td>
<td>One rule set gives one target playlist "Rules: \<name\>"</td>
</tr>
<tr>
<td>**Rule**</td>
<td>id, ruleset_id, priority, type, track_uri, n, times, enabled</td>
<td>`priority` is the list position. `enabled` lets you try things in the preview</td>
</tr>
<tr>
<td>**Account / Token**</td>
<td>account_id, display_name, refresh_token (encrypted), access_token, expires_at, scopes, authorized_at</td>
<td>authorized_at + 6 months is the hard re-auth date</td>
</tr>
<tr>
<td>**TrackCache**</td>
<td>uri, name, artists, duration_ms, fetched_at</td>
<td>Temporary, for preview labels only. Expire it and refresh from the API (Terms IV)</td>
</tr>
<tr>
<td>**RunLog**</td>
<td>id, ruleset_id, started_at, finished_at, status, error, requests, retries_429, snapshot_id</td>
<td>Debugging and the nightly job's status</td>
</tr>
</table>
Storage by phase:
- **v0**: `rules.yaml` (rule sets) plus `state.json` (target ids, snapshot) plus `token.json`.
- **v1**: IndexedDB in the browser, with JSON export and import.
- **v2**: SQLite on the server.
- **v3**: SQLite or Postgres, with every row scoped by `account_id`.
Example v0 config:
```yaml
rulesets:
  - name: Gym
    source: { type: playlist, id: YOUR_PLAYLIST_ID }
    base_order: shuffle
    seed: 42
    collision: remove_from_base
    conflict: shift
    rules:
      - pin_first: spotify:track:AAA
      - every_n: { uri: spotify:track:BBB, n: 5 }
      - repeat:  { uri: spotify:track:CCC, times: 3 }
```
## 6. Tech stack
**Recommendation: TypeScript end to end.** The engine is a standalone package (`rules-engine`), tested with vitest and fast-check. The same package then runs in the v0 Node CLI, the v1 browser app, and the v2 worker.
<table header-row="true">
<tr>
<td>Option for v1</td>
<td>Pros</td>
<td>Cons</td>
<td>Verdict</td>
</tr>
<tr>
<td>**Web app (SPA)**: Vite + React, served at `http://127.0.0.1:5173`</td>
<td>PKCE runs fully in the browser with no secret or backend. The rich preview and drag-to-reorder UI is easy. It can later be hosted on HTTPS or wrapped as a PWA for the phone</td>
<td>The loopback redirect means laptop-only until it's hosted. The refresh token lives in browser storage</td>
<td>**Recommended** for v1</td>
</tr>
<tr>
<td>**Android app** (Kotlin + Compose, Spotify auth library or AppAuth with PKCE)</td>
<td>Native on the phone where you listen; secure token storage (Keystore)</td>
<td>The most work, the engine must be ported (or use Kotlin Multiplatform), and the build and sideload loop is slower</td>
<td>Later, if phone-first editing matters</td>
</tr>
<tr>
<td>**Script only** (Node/TS CLI, or Python + spotipy's PKCE manager)</td>
<td>Fastest way to validate the idea (plan step 1); no UI work</td>
<td>Editing YAML; no visual preview</td>
<td>**v0** (the first week), not v1</td>
</tr>
</table>
For v2: a Node worker on any always-on host (a small VPS, a Raspberry Pi at home, or a scheduled CI job with the refresh token kept in its secret store), with SQLite. For v3: the same server plus a hosted HTTPS UI.
## 7. Evolution path
![Deployment by phase: v0 script on the laptop, v1 local single-screen web app, v2 always-on nightly worker, v3 hosted multi-user (up to 5) app.](notion-file-block://e4cc2a9c-cd4d-40df-a30d-169d1645de27/4aaca52e-f5da-4245-8db6-deb426ae1a7d?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=07_deployment_phases.png)
<table header-row="true">
<tr>
<td>Phase</td>
<td>Scope</td>
<td>Exit criteria</td>
</tr>
<tr>
<td>**v0: script spike** (about a week)</td>
<td>PKCE login over loopback; read the source; engine with unit and property tests; PUT/POST writer; YAML config. Spike: duplicate URIs, regenerate while playing, autoplay after the last track</td>
<td>The "Rules: Gym" playlist is right and you listen to it for a week (plan step 2)</td>
</tr>
<tr>
<td>**v1: single-screen UI**</td>
<td>Source picker, rule list with drag order, live preview with conflict badges, Regenerate. IndexedDB storage; JSON export</td>
<td>You use it instead of editing YAML; the open decisions (§4.3) are settled</td>
</tr>
<tr>
<td>**v2: nightly server**</td>
<td>Worker plus SQLite plus encrypted refresh token; schedule per rule set (e.g. 04:00 IST so it doesn't land mid-listen); run log; re-auth reminder before 6 months; QUOTA_EXCEEDED back-off</td>
<td>A week of nightly runs with no manual fixes</td>
</tr>
<tr>
<td>**v3: multi-user (≤5)**</td>
<td>Hosted HTTPS UI and redirect URI; per-user data keyed by `account_id`; dashboard allowlist; privacy policy plus end-user terms; "Disconnect and delete my data"; the two-dashboard UI from the original idea</td>
<td>Friends can sign in. Disconnecting deletes all their rows and tokens</td>
</tr>
</table>
## 8. Security, privacy and Spotify terms
**Security**
- PKCE with no client secret anywhere. The Client ID isn't secret, but it is still a "Security Code" under Terms VI: one per app, not shared with other apps.
- Always check `state`. Use a fresh verifier per login. Keep tokens out of logs and URLs.
- The server encrypts refresh tokens at rest, holds keys in env or KMS, and uses HTTPS only. The browser gets a strict CSP and no third-party scripts.
- Request least-privilege scopes (§3.1). Leave out `playlist-modify-public` unless needed.
**Privacy (Developer Terms V, Developer Policy I)**
- Request and keep only the data needed to run the app.
- Provide an easily reachable **disconnect** option. On disconnect, delete that user's data and tokens. Users can also revoke the app in their Spotify account settings.
- Before anyone other than you uses it (v3): show a **privacy policy**, and get agreement to an end-user agreement with Spotify's minimum terms.
- Don't email users using data from Spotify, and don't sell any data.
**Content rules**
- **Terms IV (Restrictions)**: don't store Spotify content indefinitely. Caching is limited to temporary metadata or cover art. That is why TrackCache is short-lived and the source of truth is always the API.
- **Policy II, "Artificial manipulation"**: don't artificially increase play counts, including with "any bot, script or automated process". This app never plays audio. The nightly job edits a playlist; it doesn't stream. Keep repeat counts moderate and never pair this with automated playback.
- **Policy III item 11**: don't mimic or replace a core Spotify experience without permission; add independent value. Rule-based ordering of your own playlist is the added value. Don't grow it into a player.
- **Policy III items 13–14**: no analysis to build listenership metrics or user profiles, and no ML or AI training on Spotify content.
- **Attribution (Policy II)**: where the UI shows track metadata, attribute it to Spotify and link each track back to Spotify.
- **Development mode is non-commercial**: no monetisation.
## 9. Open questions and risks
<table header-row="true">
<tr>
<td>Risk / question</td>
<td>Impact</td>
<td>Mitigation</td>
</tr>
<tr>
<td>Duplicate URIs in a playlist written by the API: allowed and kept? (not documented)</td>
<td>Repeat and collision "keep" depend on it</td>
<td>Test in the v0 spike first. If they get deduplicated, the repeat rule can't work as designed</td>
</tr>
<tr>
<td>Regenerating mid-listen can make playback jump or restart</td>
<td>Bad listening experience</td>
<td>Regenerate at night (v2) or on demand only; v2+ option: diff with reorder calls instead of replace</td>
</tr>
<tr>
<td>Autoplay after the last track switches to Spotify's recommendations</td>
<td>The rules seem to stop working at the end</td>
<td>Document it; the user can turn Autoplay off in Spotify settings; make outputs long enough</td>
</tr>
<tr>
<td>Owner Premium lapses, so the app stops working</td>
<td>Total outage</td>
<td>Clear 403 messaging</td>
</tr>
<tr>
<td>5-user cap; whether end users need Premium is unconfirmed</td>
<td>Limits v3</td>
<td>Treat it as a personal tool; test with one friend before promising more</td>
</tr>
<tr>
<td>Refresh token hard expiry at 6 months</td>
<td>The nightly job silently stops</td>
<td>Store authorized_at; remind about 2 weeks early; the run log shows "re-auth needed"</td>
</tr>
<tr>
<td>Dev-mode quota (shared per developer) → 429 QUOTA_EXCEEDED</td>
<td>Large Liked Songs libraries hit it</td>
<td>Use the `fields` filter, cache the base for the preview, avoid redundant regenerations, back off</td>
</tr>
<tr>
<td>Sources limited to owned or collaborative playlists and Liked Songs</td>
<td>Can't use Spotify-made or friends' playlists</td>
<td>Copy them manually into your own playlist (plan workaround)</td>
</tr>
<tr>
<td>Spotify API churn (Feb 2026 renames and removals; Mar 2026 reverted some)</td>
<td>Breakage</td>
<td>Keep all endpoint knowledge in the integration layer; contract tests on recorded fixtures; watch the changelog</td>
</tr>
<tr>
<td>Policy II repeats; public launch effectively closed</td>
<td>Compliance and scope</td>
<td>Moderate repeats; personal-only positioning</td>
</tr>
</table>
## 10. Sources (checked 13 Oct 2026)
- Authorization Code with PKCE: [developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- Refreshing tokens (6-month refresh token lifetime): [developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- Redirect URIs (loopback, no [localhost](http://localhost)): [developer.spotify.com/documentation/web-api/concepts/redirect_uri](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
- Scopes: [developer.spotify.com/documentation/web-api/concepts/scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)
- Get playlist items: [developer.spotify.com/documentation/web-api/reference/get-playlists-items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- Update (reorder or replace) playlist items: [developer.spotify.com/documentation/web-api/reference/reorder-or-replace-playlists-items](https://developer.spotify.com/documentation/web-api/reference/reorder-or-replace-playlists-items)
- Add items to playlist: [developer.spotify.com/documentation/web-api/reference/add-items-to-playlist](https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist)
- Create playlist: [developer.spotify.com/documentation/web-api/reference/create-playlist](https://developer.spotify.com/documentation/web-api/reference/create-playlist)
- Get saved tracks: [developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks)
- Get current user's playlists: [developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)
- Get playlist (fields, snapshot_id): [developer.spotify.com/documentation/web-api/reference/get-playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)
- Playlists concept (snapshot_id, limits): [developer.spotify.com/documentation/web-api/concepts/playlists](https://developer.spotify.com/documentation/web-api/concepts/playlists)
- Rate limits: [developer.spotify.com/documentation/web-api/concepts/rate-limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- Quota modes (dev mode, extended quota): [developer.spotify.com/documentation/web-api/concepts/quota-modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- February 2026 migration guide: [developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Changelogs: [February 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026), [March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026), [May 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026), [July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
- Developer access update (6 Feb 2026): [developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- Developer Policy: [developer.spotify.com/policy](https://developer.spotify.com/policy) · Developer Terms: [developer.spotify.com/terms](https://developer.spotify.com/terms)
