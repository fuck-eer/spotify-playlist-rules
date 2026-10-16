> **Design ID: DSN-20261016-playlist-rules**  
> Mockup files: [DSN-20261016-playlist-rules/](./DSN-20261016-playlist-rules/index.html)  
> Exported from Notion: https://app.notion.com/p/3fb425073e2481e5bdf2f20cbd1a186a (fetched 2026-10-16)

# DSN-20261016-playlist-rules · rulemix mobile mockup

## Status
Final
## Where to find it
- **Design ID:** DSN-20261016-playlist-rules
- **Folder:** `/workspace/designs/DSN-20261016-playlist-rules/` (on the shared agent box)
- **Main file:** `index.html` (+ `desktop.png`, `mobile.png`, `editor.png`, `dialog.png`; v1 in `v1/`)
- **Chat:** grokbot://app/v1/agent?id=59b1743e-7b8f-4a8b-8bc6-41e091ebedd4
- No live link or repo.
## Screenshots
**Current (v2.2, after the v2 review):** desktop, mobile builder with the dot preview, the editor showing Repeat, and the blocked delete dialog.
![](notion-file-block://f3dc2cee-1c24-4d7a-9009-383e50de8357/f281f01b-29fc-4d03-a63b-dd5bf6691609?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=desktop-v2-2.png)
![](notion-file-block://d3c3448e-cc4d-4adf-8062-2e8623a5773d/a97ce1f5-0d89-4816-bbb9-468cc9523873?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=mobile-v2-2.png)
![](notion-file-block://19ff11d3-722a-4278-95d7-5ac2f66e01df/7336e426-f6a3-4514-b77b-d1f62689ed46?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=editor-v2-2.png)
![](notion-file-block://9021fc65-d69c-4784-a488-d18029f940ca/8295cf61-b893-405c-b1af-b4c4afc07f2f?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=dialog-v2-2.png)
**v2 (superseded, still shows Skip):**
![](notion-file-block://8ecfc0ba-2595-43f9-bd4a-be6886ed4aad/1dabff69-e8cc-46df-9aa7-8cfbc7e632ef?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=desktop-v2.png)
![](notion-file-block://0e345d2e-c29d-4182-8980-cbd832e58f9f/d431ea8a-20dd-4d4e-9bc9-770693227539?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=mobile-v2.png)
![](notion-file-block://97dd77df-9e35-4c48-8ece-b0fa2738bd87/dfe5423b-4eba-4bbc-ae2a-8bbc4920d8a9?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=editor.png)
**v1 (superseded, files in ****`v1/`****):**
![](notion-file-block://6fdf78c1-a3c8-430a-aff4-1b80cd8860c8/09217e42-e894-4050-b67c-06ed50bfbb8a?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=desktop.png)
![](notion-file-block://7eb6ff25-0673-46de-8381-6d5d16b1a5ab/35979077-3ec7-4638-b335-dcca5ce61129?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=mobile.png)
## Source idea
<mention-page url="https://app.notion.com/p/3fa425073e24810782c7efdca91fc3f3"/>
## Brief
- **From:** Lona's handoff, 2026-10-16
- **Idea:** a personal power-user tool. Rules (pin first, every N songs, repeat N times; priority = order) are applied to a Spotify playlist, and the tool generates a new 'Rules: \<name\>' playlist through the Web API. That playlist is played in Spotify with shuffle off. There is no live playback control.
- **Users:** Nishchay + up to 4 friends (Spotify dev mode).
- **Screens:** Home (mixes + top-right Rules icon) · Mix builder (source, ordered rules, options, preview, Generate) · Rules library (add/edit/pin/archive/delete) · Rule editor (sentence builder + graphic on top).
- **Look:** Spotify-like palette, minimal. **Tone:** simple, a little playful, a little techy, no overclaims. **Format:** quick HTML mockup with minimal animation.
- Files: `/workspace/designs/DSN-20261016-playlist-rules/` (index.html, desktop.png, mobile.png)
## Research
- **References:** [Spotify design guidelines](https://developer.spotify.com/documentation/design) · [Apple Music Smart Playlists](https://support.apple.com/guide/music/create-edit-and-delete-smart-playlists-mus1712973f1/mac) · [iOS Shortcuts](https://support.apple.com/guide/shortcuts/welcome/ios) · [IFTTT](https://ifttt.com/explore) · [Gmail filters](https://support.google.com/mail/answer/6579) · [Smarter Playlists](https://smarterplaylists.playlistmachinery.com/)
- **Borrow:** dark surfaces, cover-art rows, bold left headings, green only on the primary action, numbered rule blocks with drag handles, sentence rules with pill tokens, a numbered tile-strip preview with rule tints.
- **Avoid:** Spotify green, the circle or waves, or 'Spotify' in our logo or name; node graphs; sparkles, gradients, glass or 'magic' copy; fake playback controls; motion beyond reorder, reflow and screen changes.
- **Direction: Sequencer.** Chosen because these power users think in track slots. Numbered cards and a tile strip show exactly where each rule lands, which needs no explanation.
- **Naming:** a session is a **Mix** ('New mix' → 'Rules: \<name\>').
## Questions & answers
- **To Nishchay:** none. The brief was complete.
- **Copywriter Q1: does Repeat play back to back or spread out?** Answered by Lona: **back to back**. The editor graphic shows the repeated tiles consecutively. Caption: '×\[N\] · plays back to back'.
- **Copywriter Q2: does deleting a global rule remove it from every mix?** **Resolved by Nishchay (via Lona), 2026-10-16:** a rule used in any mix can't be deleted, and the app suggests Archive instead. Unused rules can be deleted.
- **Skip every N: removed by Nishchay (via Lona), 2026-10-16.** Dropped entirely. The v1 rule types are Pin first, Every N songs and Repeat, and every rule takes a song when it's added to a mix.
## Decisions
- Product name **rulemix**. The logo is a white 3×3 tile-grid mark with a lowercase wordmark and no green.
- #1DB954 appears only on primary actions (after review: Generate playlist only).
- Rule priority is shown as a mono #01/#02 gutter. Each rule gets its own tint, which also appears on its preview tiles.
- In the preview, the top rule wins a conflict: a song claimed by a higher rule is skipped by lower ones.
- The open decisions from the plan (base order, collision) appear as two toggles under OPTIONS.
- Motion is limited to \~200ms: screen slide/fade, drag reorder, preview reflow, toast.
- The Rules icon sits top right on Home and the Builder.
- Delete is blocked for rules in use. The dialog offers Archive / Not now, and there is no force delete. Unused rules get a plain Delete / Cancel confirm. The sample library includes an unused rule ('Play Stronger 3 times.') so the confirm can be reached.
- **Rules are song-less templates.** The song is chosen when a rule is added to a mix: + Add rule → 'Add a rule' picker → 'Pick the rule's song' (source songs). Every rule type has a song step. The same rule can carry a different song in each mix.
- Rule types (v1): **Pin first, Every N songs, Repeat**. Skip every N was dropped.
- **Preview is a dot row**: one dot per song, coloured by rule.
- **Editor graphic** is an SVG dot row: Pin = first dot coloured with #01; Every N = a coloured dot after each N; Repeat = one coloured dot with a self-loop and N×.
- Rule colour = position in the mix (#1–#5). A mix is capped at 5 rules, and + Add rule hides at the cap. The library and rule picker use neutral grey dots, and the editor draws the draft in white, so no colour repeats are visible.
- One SVG dot renderer serves both the editor and the preview. Repeat is a single dot with a self-loop and N× in both, and coloured preview dots carry a tiny mono #n.
- The preview summary shows the true total for the 412-song source (e.g. '514 tracks · 3 rules applied'). The dots show only the first 22. 'Save & add to mix' shows only when the editor was opened from a mix.
## Features shipping
- Clickable flow: sign-in → Mixes → Builder → Rules library → Rule editor, with back navigation.
- Builder: name field, source card with the Spotify-made hint, drag-to-reorder rules (numbers and preview update live), two toggles, a live preview tile strip with a track/rule summary, and Generate → success toast → Regenerate.
- Library: Active/Pinned/Archived tabs; overflow menu with Edit/Pin/Archive/Delete; the delete dialog.
- Builder add flow (v2): rule picker sheet → song picker sheet, then the card appears and the dot preview updates.
- Editor (v2): 3 chips; the N pill cycles 2–6; a live SVG dot graphic + caption + helper; Save rule / Save & add to mix (adds to the current mix when opened from the builder).
- Desktop shows 5 phones side by side; mobile (≤600px) shows one phone that opens on the builder.
## Limitations
- Sample data only. There is no real Spotify auth, playlist picker or API call, and the source card is static.
- The preview algorithm is illustrative. Repeat inserts at the song's base position, or at slot 6 if the song is absent.
- The song and number pills cycle through values when tapped. There is no search sheet or numeric input.
- Removing a rule from a mix isn't built in the builder yet, so a blocked rule can't be unblocked in the mock.
- The 5-rule cap has no copy yet: the add button simply hides.
- The preview dots stop at 22 with no 'more' indicator.
- The song picker lists 12 sample songs. There's no search.
- The error toast and the empty-state copy exist in the copy deck. Only the empty rules and empty library states are reachable.
## Copywriting
- **Voice:** plain, a little playful, techy mono labels, no overclaims.
- **Name:** rulemix (alternatives: Every N, Pinlist).
- **Sign-in:** 'Your playlist, your order. Spotify just plays it.' (Tagline B, replaced A after review) · 'Continue with Spotify' · 'Dev mode: access is limited to the owner and 4 friends.'
- **Home:** Mixes · New mix · 'No mixes yet' / 'Pick a playlist, add a rule or two, and generate a copy to play in Spotify.' · meta 'Liked Songs · 3 rules · 2h ago' / '… · not generated' · Rules
- **Mix builder:** 'Name this mix' · SOURCE · 'Your playlists, collabs or Liked Songs.' · 'Discover Weekly and other Spotify-made lists need a copy in your library first.' · RULES · 'Drag to reorder. The top rule wins a conflict.' · '+ Add rule' · 'No rules yet. Without one, you just get a copy.' · OPTIONS · 'Keep base order' / 'Off reshuffles the base list once before rules run.' · 'Remove rule songs from base' / 'Rule songs only play where a rule puts them.' · PREVIEW · '42 tracks · 3 rules applied' · 'Generate playlist' / 'Regenerate' · 'Saved "Rules: Gym" to Spotify. Play it with shuffle off.' · 'Couldn't create the playlist. Check your connection and retry.'
- **Rules library:** Rules · Active / Pinned / Archived · Edit / Pin / Archive / Delete · empty heading 'No rules yet' / 'No rules here. Make one once and use it in any mix.' · New rule
- **Rules, final copy (v2):** chips Pin first / Repeat / Every N songs · templates 'Play a song first' / 'Play a song \[N\] times in a row' / 'Play a song after every \[N\] songs' · captions '#01 · this song leads the mix' / '\[N\]× · same song, in a row' (final Repeat copy) / 'every \[N\] · lands after each \[N\] songs' · helper 'You pick the song when you add this rule to a mix.' · rule picker 'Add a rule' · song picker 'Pick the rule's song' / 'Songs from this mix's source playlist.' · card lines 'Pin first · Mr. Brightside' / 'Repeat · Mr. Brightside · 2×' / 'Every 4 · Mr. Brightside' · legend 'One dot per song. Colour shows the rule.'
- **Sample data:** mixes 'Gym' and 'Late drive'; source 'Liked Songs · 412 songs'
- **Delete dialog (final):** **blocked (in use):** heading 'Used in 1 mix' / 'Used in \[N\] mixes' · body 'Remove it from that mix to delete it, or archive it now.' / 'Remove it from those mixes to delete it, or archive it now.' · buttons 'Archive' / 'Not now'. **Confirm (unused):** 'Delete this rule?' · 'It isn't used in any mix.' · buttons 'Delete' / 'Cancel'
- **Rule editor (v1, superseded):** New rule / Edit rule · Pin first / Every N songs / Repeat · 'Play \[song\] first.' / 'Play \[song\] after every \[N\] songs.' / 'Play \[song\] \[N\] times.' · captions '#01 · always track one' / 'every \[N\] · after tracks \[N\], \[2N\], \[3N\]…' / '×\[N\] · plays back to back' · Save rule · Save & add to mix · 'Pick a song and a number above 0.'
## Review
**Verdict (Design Researcher): needs fixes (minor).** All fixes are applied.
1. Green on more than Generate → 'Continue with Spotify' and 'Save & add to mix' are now white buttons. Only Generate is green.
2. Preview was buried below Options → PREVIEW and the strip now sit directly under RULES. The scroll area has 130px bottom padding to clear the dock.
3. Rule colours were tied to position → each rule has one fixed colour across the builder, library dot and editor strip.
4. The editor strip had a music-note label and clipped tiles → tiles are labelled #n, and the strip shows 8 whole tiles.
5. The dock gradient → the dock is solid var(--bg) with a 1px var(--line) top border.
6. Diagonal and striped covers → replaced with flat 2×2 mosaic covers.
7. The source card showed the picker hint → it now shows the selection: 'Liked Songs · 412 songs' (sample). There's no picker sheet yet, so the hint isn't shown anywhere.
8. Tagline swapped to the Copywriter's option B.
**v2 review (Design Researcher):** needs fixes. All applied in v2.2; the Skip-related points are moot after Skip was removed.
1. Colours ran out and repeated → colour by position in the mix, cap a mix at 5 rules, neutral dots in the library.
2. The preview wasn't accessible → a tiny mono #n under each coloured dot, plus role=img and an aria-label summary on the preview.
3. The editor and preview drew Repeat differently → one SVG renderer, with Repeat as a self-loop N× in both.
4. Draft colour clashed → the editor draft is drawn in neutral white.
5. The summary didn't match the source count → the true total is shown, with the dots truncated to the first 22.
6. The editor layout was loose → removed the empty spacer, put the 3 chips on one row, and set the sentence to 24px with no orphan words.
7. Dead CSS → removed .tile and .viz .strip.
## Change log
- **2026-10-16:** Applied the 8 review fixes. Copy updates: tagline B, delete heading singular/plural, empty library heading, sample mix 'Run' → 'Late drive'. Retook desktop.png and mobile.png (mobile shows the builder with the preview strip). Status set to Final.
- **2026-10-16 (later):** Delete rule settled. Rules in use are blocked (Archive / Not now, 'Delete anyway' removed), unused rules get a Delete / Cancel confirm. Added the unused sample rule 'Play Stronger 3 times.' Added dialog.png.
- **2026-10-16 (v2):** Rules became song-less, with the song picked per mix. Added Skip every N, the rule and song picker sheets, the dot preview with legend, and the SVG editor graphic with the Repeat self-loop. Applied the final copy. Backed up the v1 index.html and screenshots to `v1/`, retook desktop.png and mobile.png, and added editor.png. Logged Skip as an open question. Status went to In progress during the update, then back to Final.
- **2026-10-16 (v2.1):** Skip every N removed (Nishchay via Lona): its chip, template, caption, card line, dashed-ring graphic, song-step bypass, the Gym Skip rule (Gym is back to 3 rules) and the library entry. Screenshots not retaken yet while the Design Researcher's v2 review is pending, so editor.png and mobile.png still show the Skip version.
- **2026-10-16 (v2.2):** Applied the v2 review fixes (see Review). Final Repeat copy: 'Play a song \[N\] times in a row' / '\[N\]× · same song, in a row'. Retook and uploaded desktop.png, mobile.png, editor.png and dialog.png (the library dots are now neutral).
- **2026-10-16 (v2.3):** Nishchay's Mix builder feedback. The mix name field is smaller (24px/800 → 16px/700), and the screen order is now name → SOURCE → PREVIEW (summary, dots, legend) → RULES → OPTIONS. The previous index.html is backed up to `v2/`. Screenshots are not retaken yet because motion is next.
![](notion-file-block://67f844d6-bafd-4fb7-9e21-3fad400010f1/475530ae-e44e-470c-8cea-db25d813f7fa?space_id=0846ad20-4c36-410e-9877-aa58f075e9db&name=dialog.png)
## Motion
### Brief
In-page UI motion for the rulemix mockup (no video). Animate the dot-line preview in the Mix builder and the rule editor (draw in, reflow on change or reorder, Repeat loop draws in, pinned dots slide to slot 1, Every N dots drop in). Rule cards get a staggered entrance, drag reorder where neighbours slide, animated renumbering, and preview dots that move in sync. Light extras: Rules library rows and add-rule sheets. Tone: minimal, Spotify-like, a little playful, 180-320ms. Respect prefers-reduced-motion. No copy or layout changes.
### Decisions
- **Easing:** one curve everywhere, cubic-bezier(.2,.8,.2,1). It's a fast ease-out with no overshoot, so it feels responsive without bounce.
- **Durations:** 200ms for renumbering and sheet fades, 240ms for neighbour slides and colour changes, 260-300ms for dot and card moves, 320ms for the sheet slide-up and loop stroke draw. All within the 180-320ms band.
- **Choreography:** the first draw staggers dots left to right along the line (16ms each), so the line reads in order. On a reflow, kept dots move first (small stagger capped at 90ms) and new dots drop in after an 80ms delay, so cause comes before effect. Cards stagger 50ms when the builder opens, sheet rows stagger 30ms, and library rows 35ms (capped at 10 items).
- **FLIP / diff:** each dot has a stable identity: base songs are s:\<song\>, rule dots are r:\<song\>:\<occurrence\>, and Repeat loops are loop:\<song\>. Editor dots use ordinal keys (g0…, w0…, L). Before a re-render the old positions are read from data attributes. Then each kept dot is inverted from its old slot to its new one, its colour tweens if its rule's priority colour changed, and unseen dots drop in. Pinned dots therefore slide to slot 1 instead of swapping. Cards use the same FLIP approach on offsetTop, not getBoundingClientRect, so it stays correct under the desktop stage's CSS zoom.
- **Triggers:** opening the builder or editor draws in from scratch. A drag swap slides the neighbour, renumbers with a 6px rise and fade, tweens the card's colour dot and reflows the preview dots in the same frame. On drop the card FLIPs from its dragged offset into its slot. Toggling an option reflows the preview. In the editor, changing the chip redraws, and changing N FLIPs the existing dots and drops in new ones. Adding a rule enters the new card. Opening a sheet slides it up with a backdrop fade.
- **Library:** Web Animations API plus CSS keyframes, no GSAP. The scope is small and this avoids a CDN dependency. Transforms and opacity only (plus SVG fill and stroke-dashoffset).
- **Repeat loop:** drawn with pathLength=1 and a stroke-dashoffset tween from 1 to 0. It redraws when its count changes.
- **#preview hash:** now scrolls to the PREVIEW label, which sits under the name (it replaces the stale -330 offset).
### Reduced motion
With prefers-reduced-motion: reduce, the JS animation helper is a no-op and a CSS rule disables every animation and transition, including screen transitions. All states appear instantly in their final positions.
### Limitations
- Removed dots and removed cards disappear without an exit animation (there are no ghost elements).
- Dots that wrap to another row slide diagonally.
- Only read-through checks of the code were done, per the brief (no test or verification passes). The captures were made once with headless Chromium and haven't been reviewed frame by frame.
### Output files
- /workspace/designs/DSN-20261016-playlist-rules/index.html (backup of the previous version: v3/)
- motion/[builder-motion.mp](http://builder-motion.mp)4, motion/builder-motion.gif (reorder plus preview reflow)
- motion/[editor-motion.mp](http://editor-motion.mp)4, motion/editor-motion.gif (N and chip changes)
- motion/mobile.png (builder at 390×844 @2x)
