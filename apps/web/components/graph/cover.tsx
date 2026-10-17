"use client";

import type { GraphNode } from "@rulemix/rules-engine";
import { motion, type MotionStyle } from "motion/react";
import { useState, type CSSProperties, type PointerEventHandler, type Ref } from "react";
import { easeIn, POP_CSS, useMotion } from "@/lib/motion";
import { NEUTRAL_DOT, ruleColor } from "@/lib/palette";
import { coverLabel, slotLabel, type RuleMeta, type TrackMeta } from "./labels";

export const COVER = 48;
const easeOutT = (duration: number) => ({ duration, ease: [0.2, 0.8, 0.2, 1] as const });
const RING = 3;

/** Deterministic gradient placeholder for missing or loading art. */
export function placeholder(uri: string): string {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) >>> 0;
  const a = h % 360;
  return `linear-gradient(135deg, hsl(${a} 35% 38%), hsl(${(a + 50) % 360} 40% 22%))`;
}

function ringBackground(node: GraphNode): string {
  if (node.ruleIndex === null) return NEUTRAL_DOT;
  const [a, b] = node.ruleIndices;
  if (b !== undefined && a !== undefined) {
    // Split ring: two halves for a merged slot (ADR-0020).
    return `conic-gradient(${ruleColor(a)} 0 50%, ${ruleColor(b)} 50% 100%)`;
  }
  return ruleColor(node.ruleIndex);
}

export interface CoverProps {
  node: GraphNode;
  track: TrackMeta | undefined;
  rules: RuleMeta[];
  style?: CSSProperties | undefined;
  onClick?: ((el: HTMLButtonElement) => void) | undefined;
  onPointerDown?: PointerEventHandler<HTMLButtonElement> | undefined;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement> | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  dropTarget?: boolean | undefined;
  lifted?: boolean | undefined;
}

/** One circle cover: ring, `#n` chip, stack `xN`, slot number, `moved from #p`. */
export function Cover({
  enterDelay,
  animateLayout = true,
  dragOffset,
  flyFrom,
  sweep,
  node,
  track,
  rules,
  style,
  onClick,
  onPointerDown,
  onKeyDown,
  buttonRef,
  dropTarget,
  lifted,
}: CoverProps & {
  enterDelay?: number | undefined;
  animateLayout?: boolean | undefined;
  /** Finger offset while dragged (a transform, so it never triggers a layout animation). */
  dragOffset?: { x: number; y: number } | undefined;
  /** New rule copy: fly in from the source cover (#4), offset from this slot, and stagger. */
  flyFrom?: { dx: number; dy: number; delay: number } | undefined;
  /** The ring just took a rule colour: sweep it in (#7). */
  sweep?: boolean | undefined;
}) {
  const m = useMotion();
  const fly = m.reduced ? undefined : flyFrom;
  const doSweep = !m.reduced && sweep === true && node.ruleIndex !== null;
  const deleting = node.role === "copy" || node.plays > 1;
  const [loaded, setLoaded] = useState(false);
  const isCopy = node.role === "copy";
  const chipIndex = isCopy || node.plays > 1 ? node.ruleIndex : null;
  const art = track?.imageUrl ?? null;
  return (
    <motion.li
      data-testid="cover"
      data-key={node.key}
      className="absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 list-none flex-col items-center"
      data-fly={fly ? `${Math.round(fly.dx)},${Math.round(fly.dy)}` : undefined}
      data-sweep={doSweep ? "1" : undefined}
      style={style as MotionStyle}
      layout="position"
      layoutDependency={
        animateLayout ? `${String(style?.left)},${String(style?.top)}` : "measuring"
      }
      initial={
        m.reduced
          ? false
          : fly
            ? { x: fly.dx, y: fly.dy, scale: 0.6, opacity: 0.2 }
            : { scale: 0.5, opacity: 0 }
      }
      animate={{ scale: 1, opacity: 1, x: dragOffset?.x ?? 0, y: dragOffset?.y ?? 0 }}
      exit={
        m.reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : { scale: deleting ? 0.6 : 0.2, opacity: 0, transition: easeIn(0.18) }
      }
      transition={{
        ...m.pop,
        delay: m.reduced ? 0 : (fly?.delay ?? enterDelay ?? 0),
        layout: m.snap,
        // Follow the finger 1:1 while lifted; on drop/cancel spring from the finger to the slot (#10/#11).
        x: lifted || m.reduced ? { duration: 0 } : { ...m.snap, delay: fly?.delay ?? 0 },
        y: lifted || m.reduced ? { duration: 0 } : { ...m.snap, delay: fly?.delay ?? 0 },
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={coverLabel(node, track, rules)}
        onClick={(e) => onClick?.(e.currentTarget)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="relative grid size-12 touch-pan-y select-none place-items-center rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
        style={{
          transform: lifted ? "scale(1.14)" : "scale(1)",
          transition: m.reduced ? "none" : `transform 288ms ${POP_CSS}, box-shadow 160ms`,
          boxShadow: lifted ? "0 10px 28px #000c" : undefined,
          outline: dropTarget ? "2px dashed #fff" : undefined,
        }}
      >
        {node.plays > 1 ? (
          <>
            <span
              aria-hidden
              className="absolute size-12 rounded-full"
              style={{
                background: ringBackground(node),
                transform: "translate(6px,-4px)",
                opacity: 0.6,
              }}
            />
            <span
              aria-hidden
              className="absolute size-12 rounded-full"
              style={{
                background: ringBackground(node),
                transform: "translate(3px,-2px)",
                opacity: 0.8,
              }}
            />
          </>
        ) : null}
        <span
          aria-hidden
          data-testid="ring"
          data-ring={
            node.ruleIndex === null ? "plain" : node.ruleIndices.length > 1 ? "split" : "rule"
          }
          className="absolute inset-0 rounded-full"
          style={{ background: doSweep ? NEUTRAL_DOT : ringBackground(node) }}
        />
        {doSweep ? (
          // Rule colour sweeps clockwise over the plain ring (#7): 320 ms (+140 ms on a new copy).
          <motion.span
            aria-hidden
            data-testid="ring-sweep"
            className="absolute inset-0 rounded-full"
            style={{ background: ringBackground(node) }}
            initial={{
              clipPath: "polygon(50% 50%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%)",
            }}
            animate={{
              clipPath: "polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%)",
            }}
            transition={{ ...easeOutT(0.32), delay: isCopy ? 0.14 : 0 }}
          />
        ) : null}
        <span
          aria-hidden
          className="absolute overflow-hidden rounded-full"
          style={{ inset: RING, background: placeholder(node.uri) }}
        >
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art, sized by CSS
            <img
              src={art}
              alt=""
              loading="lazy"
              width={COVER}
              height={COVER}
              onLoad={() => setLoaded(true)}
              className="size-full object-cover transition-opacity"
              style={{ opacity: loaded ? 1 : 0 }}
            />
          ) : null}
        </span>
        {node.plays > 1 ? (
          <span className="relative rounded bg-black/70 px-1 font-mono text-[11px] font-bold text-white">
            x{node.plays}
          </span>
        ) : null}
        {chipIndex !== null ? (
          <motion.span
            aria-hidden
            className="absolute -right-2 -top-1.5 rounded-full px-1 font-mono text-[10px] font-bold text-black"
            style={{ background: ruleColor(chipIndex) }}
            initial={doSweep ? { scale: 0 } : false}
            animate={{ scale: 1 }}
            transition={{ ...m.pop, delay: doSweep ? 0.2 : 0 }}
          >
            #{chipIndex + 1}
          </motion.span>
        ) : null}
      </button>
      <span
        className={`mt-1 font-mono text-[11px] font-medium ${node.ruleIndex === null ? "text-dim" : "text-mut"}`}
      >
        {slotLabel(node)}
      </span>
      {node.shiftedFrom !== null ? (
        <span className="whitespace-nowrap text-[10px] text-dim">
          moved from #{node.shiftedFrom + 1}
        </span>
      ) : null}
    </motion.li>
  );
}
