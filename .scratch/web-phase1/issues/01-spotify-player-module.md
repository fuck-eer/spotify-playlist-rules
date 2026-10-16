# 01: Spotify player module and Player playlist writer option

**What to build:** packages/spotify can write the Player playlist and start it on an active device, exactly as the spec's "packages/spotify" decision lists (names, endpoints, return values). Commit the already-made SCOPES change (two playback scopes) here.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `writeTarget` accepts optional `description`; default stays "Made by rulemix. Play with shuffle off."
- [ ] `PLAYER_PLAYLIST_NAME`, `PLAYER_PLAYLIST_DESCRIPTION`, `hasPlaybackScopes`, `findActiveDevice`, `startPlaylistPlayback`, `isPlaying` exported from the package index
- [ ] Fake-server tests: description sent on create; devices active / none active / active with null id; shuffle `state=false&device_id=D` then play `device_id=D` with `{context_uri}` in that order, no `uris` key; currently-playing 204 → false, `is_playing:false` → false, `true` → true; scopes with both / one / none
- [ ] `SCOPES` includes `user-read-playback-state` and `user-modify-playback-state`
