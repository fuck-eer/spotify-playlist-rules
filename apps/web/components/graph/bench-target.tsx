"use client";

import { Armchair, Trash2 } from "lucide-react";
import { forwardRef } from "react";

export type TargetKind = "bench" | "delete";

/** Bottom-right corner pill shown while a cover is dragged (§12). */
export const BenchTarget = forwardRef<HTMLDivElement, { kind: TargetKind; hover: boolean }>(
  function BenchTarget({ kind, hover }, ref) {
    const label = kind === "bench" ? "Bench" : "Delete";
    const hoverText = kind === "bench" ? "Drop to bench" : "Drop to delete";
    const Icon = kind === "bench" ? Armchair : Trash2;
    const color = hover
      ? kind === "bench"
        ? "bg-white text-black"
        : "bg-err text-white"
      : "bg-s2 text-white";
    return (
      <div
        ref={ref}
        role="img"
        aria-label={label}
        data-testid="bench-target"
        data-kind={kind}
        style={{ transform: hover ? "scale(1.12)" : "scale(1)", transition: "transform 120ms" }}
        className={`pointer-events-none absolute bottom-3 right-3 z-40 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${color}`}
      >
        <Icon aria-hidden size={16} />
        {hover ? hoverText : label}
      </div>
    );
  },
);
