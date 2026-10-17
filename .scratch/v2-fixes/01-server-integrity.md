# F01: Server arrangement integrity (B1 server, N1, N4, N5)
**Status:** done
- B1.1 Library rule PATCH that changes kind/n resets mix_rules.removed_plays/deleted_copies for that rule and bumps arrangement_version of affected Mixes.
- B1.2 putArrangement rejects (422) removedPlays != 0 for non-repeat and > n-1 for repeat.
- N1 Adding/removing/editing a Mix rule bumps arrangement_version (stale device gets 409, not 422).
- N4 manualOrder and bench: unique URIs, no overlap (422).
- N5 pruneToSource scoped by user_id.
**Acceptance:** route tests for each, both B1 paths.
