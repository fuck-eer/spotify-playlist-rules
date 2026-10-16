# 08: Rules library and Rule editor (vertical)

**Status:** done
**Type:** task
**Blocked by:** 02, 03, 06, 07
**Glossary terms:** Rule, Archive, Mix, Pin first, Insert every N, Repeat N times
**Refs:** spec stories 8–18; requirement updates (song-less rules, can't delete in use); design copy deck; mockup `index.html` (Rules library + Rule editor phones), `editor.png`, `dialog.png`, `motion/editor-motion.mp4`

## What to build
A signed-in user opens Rules (an icon at the top right of `/mixes`) and sees Active, Pinned and Archived tabs. They can create a rule in the editor (pick a type, adjust N, see a live graphic), edit, pin, archive or unarchive a rule, and delete an unused rule. Deleting a rule that a Mix uses shows the blocked dialog instead.

## Files
- `apps/web/lib/db/rules-repo.ts`:
  ```ts
  export interface RuleRow { id: string; kind: RuleKind; n: number | null; pinned: boolean; archivedAt: string | null; usedInMixes: number; createdAt: string; updatedAt: string }
  export function listRules(sql, userId: string): Promise<RuleRow[]>; // ordered pinned desc, created_at desc; usedInMixes = count(distinct mix_id)
  export function getRule(sql, userId: string, id: string): Promise<RuleRow | null>;
  export function createRule(sql, userId: string, input: { kind: RuleKind; n: number | null }): Promise<RuleRow>;
  export function updateRule(sql, userId: string, id: string, patch: { kind?: RuleKind; n?: number | null; pinned?: boolean; archived?: boolean }): Promise<RuleRow | null>;
  export function deleteRule(sql, userId: string, id: string): Promise<{ ok: true } | { ok: false; usedInMixes: number } | null>; // null = not found
  ```
- `apps/web/lib/validation.ts`: zod `RuleInputSchema`. `kind` is the enum; `n` is null for pin_first and an integer between `MIN_N` and `MAX_N` (2–10) otherwise.
- Routes (all use `requireUserApi`, JSON in and out, and `jsonError`):
  - `app/api/rules/route.ts`: GET lists rules, returning `{ rules: RuleRow[] }`. POST creates one, returning 201 `{ rule }` or 400 `invalid_rule`.
  - `app/api/rules/[id]/route.ts`:
    - GET returns `{ rule }` or 404 `not_found`.
    - PATCH applies the patch above.
    - DELETE returns 204, or 409 `{ error: { code: "rule_in_use", message: "Used in N mix(es)" }, usedInMixes }`, or 404.
- Pages and components:
  - `app/rules/page.tsx` (server, `requireUserPage`) and `components/rules/rules-library.tsx` (client):
    - Header "Rules" with a back link to `/mixes` and a "New rule" button.
    - shadcn Tabs: Active (not archived), Pinned (pinned and not archived), Archived.
    - Each row shows a neutral dot, the `ruleSentence` (N in bold), the `ruleCaption` in mono dim, and a ⋯ dropdown with Edit / Pin or Unpin / Archive or Unarchive / Delete.
    - Rows stagger 35ms, capped at 10.
    - Empty states:
      - "No rules yet" with "Make one once and use it in any mix." (Active, when the user has no rules at all);
      - "No rules here." (any empty tab).
  - **Delete flow:**
    - Unused rule: an AlertDialog "Delete this rule?" / "It isn't used in any mix." with Delete and Cancel.
    - Rule in use (the server returns 409): a Dialog headed "Used in 1 mix" or "Used in N mixes", with the body "Remove it from that mix to delete it, or archive it now." (or "…those mixes…" for N>1) and the buttons Archive and Not now. There is no force delete.
  - `app/rules/new/page.tsx` and `app/rules/[id]/edit/page.tsx` → `components/rules/rule-editor.tsx` (client):
    - Three chips: "Pin first", "Every N songs", "Repeat".
    - The sentence builder shows `ruleSentence`, with N rendered as a pill and −/+ steppers clamped to 2–10. Default N is 4 for every_n and 2 for repeat.
    - `RuleIntentGraphic` sits above it, in the draft colour. The caption below it is `ruleCaption`.
    - The buttons are "Save rule" and, only when the query has `?mix=<mixId>`, "Save & add to mix". That button saves the rule, then navigates to `/mixes/<mixId>?addRule=<ruleId>`, where ticket 10 handles the song picker.
    - After saving, go back to `/rules`.
  - Add the Rules icon button to the placeholder `/mixes` page header (top right, `aria-label="Rules"`, a 3×3 grid icon).

## Tests (write first)
- `rules-repo.test.ts` (test database):
  - create, list and get round-trip;
  - one user can't see another user's rules;
  - `usedInMixes` counts distinct mixes (insert mixes and mix_rules directly);
  - pin, archive and unarchive;
  - delete an unused rule → ok;
  - delete a used rule → `{ ok:false, usedInMixes:2 }` and the row still exists;
  - wrong user → null.
- `rules-routes.test.ts`: POST validation (pin_first with n → 400; every_n with n=11 → 400), 401 without a session, DELETE 409 body shape, PATCH archive.
- `rule-editor.test.tsx`:
  - switching chips updates the sentence;
  - the + stepper stops at 10 and − stops at 2;
  - "Save & add to mix" shows only with `?mix`.
- `rules-library.test.tsx`: tab filtering, and the 409 path showing the "Used in 2 mixes" dialog with Archive / Not now.
- `e2e/rules.spec.ts` (an authenticated session seeded directly into the database plus a cookie; see the helper below): create "Play a song after every 4 songs", see it in Active, archive it, see it in Archived.
  - Add `e2e/helpers/session.ts`: `seedSession(page)` inserts a test user and session into the test database and sets the cookie. Playwright runs the app with `DATABASE_URL=TEST_DATABASE_URL`.

## Acceptance criteria
- [x] All flows above work; the copy matches exactly
- [x] Rules carry no song anywhere (song-less templates)
- [x] All tests pass
