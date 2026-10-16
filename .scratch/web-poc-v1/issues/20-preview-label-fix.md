# 20: Preview dot label shows "#2" near slot 22

**Status:** won't fix (matches spec) — needs a product decision to change
**Type:** bug report
**Refs:** manual real-Spotify check; spec story 34; design.md (dot renderer, a11y fix 2); DSN-20261016 mockup `pvItems`; ticket 07

## Report
The repeat rule's dot near slot 22 is labelled "#2", which looks like the rule position rather than the slot.

## Finding
The label is the **rule number** by design, not the slot:
- Mockup `pvItems`: `label:"#"+x.c` where `x.c` is the rule's index/colour (pin is `#01` in the editor strip).
- Ticket 07: "`label` = `#${ruleIndex+1}` for rule dots"; base slots get no label.
- design.md: "coloured preview dots carry a tiny mono #n" — a label on coloured (rule) dots only, which ties #n to the rule colour legend.
So "#2" = rule 2 (the repeat rule) is the specified behaviour. Per instructions, not changed.

## If we want slot numbers
Change spec story 34 + design.md + ticket 07 first (and decide what labels base slots get), then `pvItems`-equivalent in the preview mapping.
