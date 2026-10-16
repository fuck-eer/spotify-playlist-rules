"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type JSX } from "react";

export interface DotItem {
  key: string;
  color: string;
  /** tiny mono "#n" under the dot */
  label?: string;
  /** repeat count > 1 => self-loop + "N×" */
  loop?: number;
  /** e.g. "moved from #4" */
  badge?: string;
  /** extra tooltip text (song name) */
  title?: string;
}

export interface DotLineProps {
  items: DotItem[];
  maxDots?: number;
  totalCount?: number;
  ariaLabel: string;
}

const R = 7;
const STEP = 22;
const PAD_X = 12;
const ROW_H = 64;
const DOT_Y = 34; // room above for loop/badge, below for label
const EASE = [0.2, 0.8, 0.2, 1] as const;

export function DotLine({ items, maxDots = 22, totalCount, ariaLabel }: DotLineProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const reduce = useReducedMotion() ?? false;
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = items.slice(0, maxDots);
  const total = totalCount ?? items.length;
  const more = Math.max(0, total - shown.length);
  const slots = shown.length + (more > 0 ? 3 : 0); // "+n more" takes ~3 slots
  const perRow = width ? Math.max(1, Math.floor((width - PAD_X * 2) / STEP) + 1) : Math.max(1, slots);
  const pos = (i: number) => ({ x: PAD_X + (i % perRow) * STEP, y: DOT_Y + Math.floor(i / perRow) * ROW_H });
  const rows = Math.max(1, Math.ceil(slots / perRow));
  const svgW = PAD_X * 2 + (Math.min(slots, perRow) - 1) * STEP;
  const svgH = rows * ROW_H;

  const isFirst = first.current;
  let kept = 0;
  let fresh = 0;
  const plan = shown.map((d) => {
    const had = seen.current.has(d.key);
    return { had, order: had ? kept++ : fresh++ };
  });
  useEffect(() => {
    first.current = false;
    seen.current = new Set(shown.map((d) => d.key));
  });

  const segments: JSX.Element[] = [];
  for (let i = 1; i < shown.length; i++) {
    const a = pos(i - 1);
    const b = pos(i);
    if (a.y === b.y) segments.push(<line key={`s${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-line)" strokeWidth={2} />);
  }
  const morePos = pos(shown.length);

  return (
    <div ref={ref} className="w-full">
      <svg role="img" aria-label={ariaLabel} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="max-w-full overflow-visible">
        {segments}
        {shown.map((d, i) => {
          const p = pos(i);
          const { had, order } = plan[i]!;
          const delay = reduce ? 0 : isFirst ? i * 0.016 : had ? Math.min(order * 0.01, 0.09) : 0.08 + Math.min(order * 0.01, 0.12);
          const title = [d.title, d.label, d.loop ? `plays ${d.loop}× in a row` : undefined, d.badge].filter(Boolean).join(" · ");
          return (
            <motion.g
              key={d.key}
              layout={!reduce}
              initial={reduce || (had && !isFirst) ? false : { x: p.x - 10, y: isFirst ? p.y : p.y - 12, opacity: 0, scale: isFirst ? 0 : 0.4 }}
              animate={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.28, delay, ease: EASE }}
            >
              <title>{title || `slot ${i + 1}`}</title>
              <circle r={R} fill={d.color} />
              {d.loop && d.loop > 1 ? (
                <g>
                  <path d="M-4 -6 C -16 -28, 16 -28, 4 -7" fill="none" stroke={d.color} strokeWidth={1.5} />
                  <path d="M4 -7 l1 -6 M4 -7 l-5 -3" fill="none" stroke={d.color} strokeWidth={1.5} />
                  <text x={11} y={-18} fill={d.color} fontSize={10} fontFamily="var(--font-mono)">{`${d.loop}×`}</text>
                </g>
              ) : null}
              {d.badge ? (
                <g transform={`translate(0 ${d.loop ? -30 : -14})`}>
                  <rect x={-d.badge.length * 2.8 - 4} y={-11} width={d.badge.length * 5.6 + 8} height={13} rx={6.5} fill="var(--color-s3)" />
                  <text textAnchor="middle" y={-2} fontSize={9} fill="var(--color-mut)" fontFamily="var(--font-mono)">{d.badge}</text>
                </g>
              ) : null}
              {d.label ? (
                <text textAnchor="middle" y={20} fontSize={9} fill="var(--color-dim)" fontFamily="var(--font-mono)">{d.label}</text>
              ) : null}
            </motion.g>
          );
        })}
        {more > 0 ? (
          <text x={morePos.x - 4} y={morePos.y + 4} fontSize={10} fill="var(--color-mut)" fontFamily="var(--font-mono)">{`+${more} more`}</text>
        ) : null}
      </svg>
    </div>
  );
}
