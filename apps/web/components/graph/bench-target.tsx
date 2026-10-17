"use client";

import { Armchair, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { useMotion } from "@/lib/motion";

export type TargetKind = "bench" | "delete";

/** Bottom-right corner pill shown while a cover is dragged (§12). */
export const BenchTarget = forwardRef<HTMLDivElement, { kind: TargetKind; hover: boolean }>(
  function BenchTarget({ kind, hover }, ref) {
    const label = kind === "bench" ? "Bench" : "Delete";
    const hoverText = kind === "bench" ? "Drop to bench" : "Drop to delete";
    const Icon = kind === "bench" ? Armchair : Trash2;
    const m = useMotion();
    const color = hover
      ? kind === "bench"
        ? "bg-white text-black"
        : "bg-err text-white"
      : "bg-s2 text-white";
    return (
      <motion.div
        ref={ref}
        role="img"
        aria-label={label}
        data-testid="bench-target"
        data-kind={kind}
        initial={m.reduced ? false : { y: 16, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, opacity: 1, scale: hover ? (m.reduced ? 1.12 : [1, 1.18, 1.12]) : 1 }}
        exit={{ y: m.reduced ? 0 : 16, opacity: 0, transition: m.easeOut }}
        transition={hover ? (m.reduced ? m.snap : { duration: 0.24 }) : m.pop}
        className={`pointer-events-none absolute bottom-3 right-3 z-40 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${color}`}
      >
        <Icon aria-hidden size={16} />
        {hover ? hoverText : label}
      </motion.div>
    );
  },
);
