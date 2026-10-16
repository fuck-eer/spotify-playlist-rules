# 21: New-mix form resets after picking a source

**Status:** done
**Type:** bug
**Refs:** manual real-Spotify check on integration 10b7e1f

## Problem
On /mixes/new, a few seconds after picking a source, the name and source fields reset (second attempt held).

## Diagnosis
Dev log of the check: `POST /api/mixes 201` → `Compiling /mixes/[id]` (cold) → `GET /mixes/<id>` → **`GET /mixes/new`** (full page load) → second `POST /api/mixes 201`. The DB had two "QA test" mixes (first one orphaned).
Root cause: after creating the mix, `MixBuilder` called `router.replace('/mixes/<id>')`, a server navigation. Until its RSC payload arrives the URL stays /mixes/new; a reload in that window (here Next dev's full reload after compiling the new route; in prod a user refresh or slow network) re-renders an empty /mixes/new, wiping the form and orphaning the created mix. Second attempt held because the route was already compiled.

## Decision
After the POST, update the URL in place with `window.history.replaceState(null, "", "/mixes/<id>")` (Next 15 syncs native history with its router). The component already holds the mix state (`mixId`), so no server navigation is needed; a reload now lands on the saved mix.

## Tests (write first)
- e2e: hold the client navigation to /mixes/<id> (stand-in for a cold compile), create via name + source, expect the URL to already be /mixes/<id>, reload, fields still show the name and source. Red before the fix (URL stayed /mixes/new).
- unit: creating updates `location.pathname` and does not call `router.replace`.

## Acceptance criteria
- [x] Form state survives a reload right after the mix is created; no orphan mixes
- [x] All tests pass
