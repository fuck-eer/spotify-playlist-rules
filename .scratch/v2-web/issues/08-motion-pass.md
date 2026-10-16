# 08: Motion pass (web)

**What to build:** all graph motion per `motion-spec.md`: wire draw-in, cover pop-in stagger, lift/settle, FLIP reflow, popover/sheet, bench target spring, bench/delete shrink, restore grow, toasts; reduced motion skips all.

**Blocked by:** 05, 07

**Status:** ready-for-agent

**Design:** motion-spec.md (tokens and interaction table), motion/*.mp4.

**Files:** `apps/web/lib/motion.ts` (`springSnap = { type: "spring", stiffness: 600, damping: 40, mass: 1 }`, `springPop` 800/40, `springSheet` 500/42, `easeOut = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }`); graph components use `motion` with stable `key`s.

**Acceptance criteria**
- [ ] Every row of the motion-spec interaction table implemented with the listed token/duration.
- [ ] `prefers-reduced-motion: reduce` → no animation (component test with matchMedia mock).
- [ ] No layout shift; 60 fps reflow on a 200-node Mix in Chrome performance trace (manual check noted in PR).
