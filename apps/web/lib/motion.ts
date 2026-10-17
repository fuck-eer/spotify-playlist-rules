"use client";

import type { Transition } from "motion/react";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
}
const snapshot = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(QUERY).matches;

/** Live `prefers-reduced-motion: reduce`. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Motion tokens (motion-spec.md). Springs are mass 1. */
export const springSnap = { type: "spring", stiffness: 600, damping: 40, mass: 1 } as const;
export const springPop = { type: "spring", stiffness: 800, damping: 40, mass: 1 } as const;
export const springSheet = { type: "spring", stiffness: 500, damping: 42, mass: 1 } as const;
export const easeOut = { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } as const;
/** Exits (dissolve, popover close, bench fly): ease-in. */
export const easeIn = (duration: number) => ({ duration, ease: [0.4, 0, 1, 1] }) as const;

/** Wire draw-in duration (#1): 180 ms + 24 ms per cover, capped at 400 ms. */
export function wireDuration(n: number): number {
  return Math.min(0.4, 0.18 + 0.024 * n);
}
/** Cover pop-in delay (#2): i/(n-1) × (D − 120 ms). */
export function popDelay(i: number, n: number): number {
  if (n <= 1) return 0;
  return (i / (n - 1)) * Math.max(0, wireDuration(n) - 0.12);
}

const NONE: Transition = { duration: 0 };

/** Tokens, or instant transitions when the user prefers reduced motion. */
export function useMotion() {
  const reduced = usePrefersReducedMotion();
  return {
    reduced,
    snap: reduced ? NONE : springSnap,
    pop: reduced ? NONE : springPop,
    sheet: reduced ? NONE : springSheet,
    easeOut: reduced ? NONE : easeOut,
    easeIn: (d: number): Transition => (reduced ? NONE : easeIn(d)),
  };
}

/** A mass-1 spring (0→1) sampled into a CSS `linear()` easing for `durationMs`. */
export function springLinear(k: number, c: number, durationMs: number, samples = 24): string {
  const w0 = Math.sqrt(k);
  const z = c / (2 * w0);
  const wd = w0 * Math.sqrt(Math.max(0, 1 - z * z));
  const x = (t: number) =>
    z < 1
      ? 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
      : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (durationMs / 1000);
    pts.push(i === samples ? "1" : x(t).toFixed(4));
  }
  return `linear(${pts.join(", ")})`;
}
/** CSS easings for transitions that stay in CSS (lift, target hover). */
export const POP_CSS = springLinear(800, 40, 288);
export const SNAP_CSS = springLinear(600, 40, 327);
