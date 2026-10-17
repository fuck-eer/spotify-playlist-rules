"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMotion } from "@/lib/motion";
import { placeholder } from "./cover";

export function benchAria(n: number): string {
  return `Bench, ${n} ${n === 1 ? "song" : "songs"}. Tap to open.`;
}

/** Collapsed bench pill: last 3 benched covers + `Bench · {n}`; hidden at 0. */
export function BenchCluster({
  bench,
  images,
  open,
  onToggle,
}: {
  bench: string[];
  images: Record<string, string | null | undefined>;
  open: boolean;
  onToggle: () => void;
}) {
  const m = useMotion();
  if (bench.length === 0) return null;
  const last = bench.slice(-3);
  return (
    <motion.button
      type="button"
      initial={m.reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={m.pop}
      whileTap={m.reduced ? {} : { scale: 0.96 }}
      aria-label={benchAria(bench.length)}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-testid="bench-cluster"
      onClick={onToggle}
      className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full bg-s2 py-1 pl-1 pr-3 text-xs font-semibold"
    >
      <span className="flex -space-x-3">
        {last.map((u) => (
          <motion.span
            key={u}
            initial={m.reduced ? false : { scale: 0.3 }}
            animate={{ scale: 1 }}
            transition={{ ...m.pop, delay: m.reduced ? 0 : 0.06 }}
            className="h-7 w-7 overflow-hidden rounded-full ring-2 ring-[#7a7a7a]"
            style={{ background: placeholder(u) }}
          >
            {images[u] ? (
              // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art, sized by CSS
              <img src={images[u]} alt="" className="h-full w-full object-cover" />
            ) : null}
          </motion.span>
        ))}
      </span>
      <span className="relative inline-block overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={bench.length}
            className="inline-block"
            initial={m.reduced ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: m.reduced ? 0 : -8, opacity: 0, transition: m.easeOut }}
            transition={m.snap}
          >
            Bench · {bench.length}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
