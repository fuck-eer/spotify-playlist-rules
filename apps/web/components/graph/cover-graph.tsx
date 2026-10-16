"use client";

import type { GraphNode } from "@rulemix/rules-engine";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Cover } from "./cover";
import type { RuleMeta, TrackMeta } from "./labels";
import { layout, type GraphLayout } from "./layout";

const OVERSCAN_ROWS = 2;
const BULGE = 34;

/** Wire segments for rows [from, to]: the row line plus the U-turn into the next row. */
export function wirePath(l: GraphLayout, count: number, from: number, to: number): string {
  const parts: string[] = [];
  for (let row = from; row <= to; row++) {
    const first = row * l.cols;
    if (first >= count) break;
    const last = Math.min(count - 1, first + l.cols - 1);
    const a = l.pos(first);
    const b = l.pos(last);
    parts.push(`M${a.x} ${a.y} L${b.x} ${b.y}`);
    if (last + 1 < count) {
      const c = l.pos(last + 1);
      const dx = row % 2 === 0 ? BULGE : -BULGE;
      parts.push(`M${b.x} ${b.y} C${b.x + dx} ${b.y} ${c.x + dx} ${c.y} ${c.x} ${c.y}`);
    }
  }
  return parts.join(" ");
}

export interface CoverGraphProps {
  nodes: GraphNode[];
  tracks: Record<string, TrackMeta>;
  rules: RuleMeta[];
  onTap?: ((node: GraphNode, el: HTMLElement) => void) | undefined;
  /** Extra layers (drag ghost, bench target) drawn inside the scroll area. */
  overlay?: ((l: GraphLayout) => ReactNode) | undefined;
  /** Per-cover props from interaction layers (drag). */
  coverProps?:
    ((node: GraphNode, i: number) => Partial<React.ComponentProps<typeof Cover>>) | undefined;
  /** Positions override, e.g. a live reorder preview. */
  order?: number[] | undefined;
  maxHeight?: number | undefined;
  extraHeight?: number | undefined;
  onLayout?: ((l: GraphLayout, scroller: HTMLDivElement | null) => void) | undefined;
}

/** The cover graph: boustrophedon line, wire per visible row, rows in viewport ± 2 rendered. */
export function CoverGraph({
  nodes,
  tracks,
  rules,
  onTap,
  overlay,
  coverProps,
  order,
  maxHeight = 560,
  extraHeight = 0,
  onLayout,
}: CoverGraphProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState({ top: 0, height: 0 });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setView({ top: el.scrollTop, height: el.clientHeight });
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    const onScroll = () => setView({ top: el.scrollTop, height: el.clientHeight });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro?.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const l = layout(nodes.length, width || 360);
  useEffect(() => onLayout?.(l, scroller.current));
  const firstRow = Math.max(0, Math.floor(view.top / l.rowHeight) - OVERSCAN_ROWS);
  const lastRow = Math.min(
    l.rows - 1,
    Math.ceil((view.top + Math.max(view.height, l.rowHeight)) / l.rowHeight) + OVERSCAN_ROWS,
  );
  const slotOf = (i: number) => (order ? (order[i] ?? i) : i);

  return (
    <div
      ref={scroller}
      data-testid="cover-graph"
      className="relative overflow-y-auto overflow-x-hidden"
      style={{ maxHeight }}
    >
      <div className="relative mx-auto" style={{ height: l.height + extraHeight, width: l.width }}>
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0"
          width={l.width}
          height={l.height}
        >
          <path
            d={wirePath(l, nodes.length, firstRow, lastRow)}
            stroke="#4a4a4a"
            strokeWidth={2}
            fill="none"
          />
        </svg>
        <ol aria-label="Play order" className="contents">
          {nodes.map((node, i) => {
            const p = l.pos(slotOf(i));
            if (p.row < firstRow || p.row > lastRow) return null;
            const extra = coverProps?.(node, i) ?? {};
            return (
              <li key={node.key} className="contents">
                <Cover
                  node={node}
                  track={tracks[node.uri]}
                  rules={rules}
                  style={{ left: p.x, top: p.y, transition: "left 260ms, top 260ms" }}
                  onClick={(el) => onTap?.(node, el)}
                  {...extra}
                />
              </li>
            );
          })}
        </ol>
        {overlay?.(l)}
      </div>
    </div>
  );
}
