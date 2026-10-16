# AGENTS.md

Spotify Playlist Rules (design name: **rulemix**). A personal tool that applies ordered rules (pin first, every N songs, repeat N times) to a Spotify playlist and writes the result to a "Rules: <name>" playlist via the Web API.

**Status:** setup and docs only. No code yet; the tech stack is undecided (see `docs/research/architecture.md` for the recommendation, `docs/open-questions/` for open decisions).

## Repo layout

```
AGENTS.md                 this file
GLOSSARY.md               domain vocabulary (single-context)
docs/
  agents/                 config for the engineering skills (issue tracker, triage labels, domain docs)
  adr/                    architecture decision records (NNNN-slug.md)
  plan/plan.md            product plan + requirements (Notion export)
  open-questions/         undecided decisions and latest requirement updates
  research/architecture.md  architecture research (Notion export)
  design/design.md        design doc, Design ID DSN-20261016-playlist-rules
  design/DSN-20261016-playlist-rules/  HTML mockup, screenshots, motion
.scratch/                 local markdown issue tracker (specs + tickets)
```

## Workflow

- Read `GLOSSARY.md`, relevant ADRs, and the docs above before working. Notion exports under `docs/` are the source of truth for requirements; don't contradict them silently.
- Work from tickets in `.scratch/<feature>/issues/`; record significant decisions as ADRs in `docs/adr/`.
- **TDD:** write a failing test first, make it pass, then refactor. The rule engine must stay a pure, unit-tested function.
- **Before every commit:** run the typecheck and the full test suite; both must pass. Never commit with failing checks.
- Small, focused commits with descriptive messages.
- Coding standards: see `CODING_STANDARDS.md`.

## Agent skills

### Issue tracker

Local markdown: issues and specs live as files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
