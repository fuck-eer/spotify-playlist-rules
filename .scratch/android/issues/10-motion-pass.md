# 10: Motion pass (Android)

**What to build:** every motion-spec interaction in Compose with `Motion` tokens: wire draw-in (`Animatable` + `PathMeasure.getSegment`), cover pop stagger, lift scale 1.14, `animateItem()` reflow, sheet spring, bench target spring, delete shrink, restore grow; reduced motion skips all.

**Blocked by:** 08

**Status:** ready-for-agent

**Design:** motion-spec.md (Compose column), motion/*.mp4.

**Acceptance criteria**
- [ ] Each motion-spec table row implemented with its token.
- [ ] Compose test with animator scale 0 → final state without animation.
