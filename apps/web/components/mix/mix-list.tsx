"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { MixRow } from "@/lib/db/mixes-repo";
import { mixMetaLine } from "@/lib/mix-meta";
import { CoverTile } from "./cover-tile";

export function MixList({ mixes }: { mixes: MixRow[] }) {
  const reduce = useReducedMotion();
  if (mixes.length === 0) {
    return (
      <div className="px-2.5 py-10 text-center text-mut">
        <h3 className="mb-1.5 text-lg text-tx">No mixes yet</h3>
        <p>Pick a playlist, add a rule or two, and generate a copy to play in Spotify.</p>
      </div>
    );
  }
  return (
    <ul>
      {mixes.map((m, i) => (
        <motion.li
          key={m.id}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.05 }}
        >
          <Link
            href={`/mixes/${m.id}`}
            className="mb-2 flex items-center gap-3 rounded-lg bg-s1 p-2.5"
          >
            <CoverTile seed={m.id} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">{m.name}</div>
              <div className="mt-0.5 text-xs text-mut">{mixMetaLine(m)}</div>
            </div>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
