# 17: Docs: native Postgres and spec data-model drift

**Status:** done
**Type:** docs
**Refs:** review S3, spec notes (users.id, mix_rules FK)

## Decision (the code is the truth)
- CODING_STANDARDS: local/test DBs are Postgres 16 on 127.0.0.1:54322 (`rulemix`, `rulemix_test`) via `docker compose up -d db` or the native cluster (`sudo pg_ctlcluster 16 main start`); see README.
- docs/spec.md data model: `users.id` (Spotify user id) plus `account_id`; `mix_rules.rule_id` FK is `NO ACTION DEFERRABLE INITIALLY DEFERRED` (deleting a referenced rule still fails with 23503); also document `mixes.source_name` and `save_runs.updated_at` and the one-running index.

## Acceptance criteria
- [x] Docs match the migrations
