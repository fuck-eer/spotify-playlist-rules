"use client";

import type { BuildResult, GraphNode } from "@rulemix/rules-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { applyDraft, draftOf, saveArrangement } from "@/lib/arrangement-client";
import { lineOf, moveOriginal, pickDropTarget, type ArrangementDraft } from "@/lib/arrangement-ops";
import type { MixState } from "@/lib/mix-state";
import { buildFromState } from "@/lib/use-mix-state";
import { GraphPanel } from "./graph-panel";
import type { GraphLayout } from "./layout";

export const LONG_PRESS_MS = 350;
export const DRAG_SLOP = 8;
export const DROP_RADIUS = 70;
const EDGE = 48;
const TOAST_MS = 4000;

export const COPY = {
  moved: (k: number) => `Moved to slot ${k}. Order saved.`,
  moveUndone: "Move undone",
  ruleStays: "Rule songs stay where their rule puts them.",
  conflict: "Updated from another device.",
  ghost: (k: number) => `Move to slot ${k}`,
  dropHere: "Drop to play it here",
  slotRange: (total: number) => `Pick a slot from 1 to ${total}.`,
};

export interface Drag {
  key: string;
  role: GraphNode["role"];
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lifted: boolean;
  target: number;
}

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}

export interface GraphApi {
  commit: (
    next: ArrangementDraft,
    message: string,
    undoMessage: string,
    undoable?: boolean,
  ) => Promise<boolean>;
}

/** The interactive PREVIEW: graph + long-press drag reorder, keyboard moves and Go to slot. */
export function MixGraph({
  mixId,
  status,
  error,
  state,
  result,
  replace,
  onTap,
  onSkipped,
  onSaved,
  extensions,
  onDrop,
}: {
  mixId: string;
  status: "loading" | "error" | "ready";
  error?: string | undefined;
  state: MixState | null;
  result: BuildResult | null;
  replace: (s: MixState) => void;
  onTap?: ((node: GraphNode, el: HTMLElement) => void) | undefined;
  onSkipped?: (() => void) | undefined;
  onSaved?: (() => void) | undefined;
  /** Hook for the bench/delete layer (v2-web/07). */
  extensions?: ((api: GraphApi, drag: Drag | null) => React.ReactNode) | undefined;
  /** Drop interceptor (bench/delete target); true = handled. */
  onDrop?: ((drag: Drag, node: GraphNode, api: GraphApi) => boolean) | undefined;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [kbd, setKbd] = useState<{ key: string; target: number } | null>(null);
  const [goto, setGoto] = useState<{ open: boolean; value: string; error: string | null }>({
    open: false,
    value: "",
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const layoutRef = useRef<{ l: GraphLayout; scroller: HTMLDivElement | null } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const nodes = useMemo(() => result?.nodes ?? [], [result]);

  /** Optimistic local apply + PUT; 409 replaces with the server state. */
  const commit = useCallback(
    async (
      next: ArrangementDraft,
      message: string,
      undoMessage: string,
      undoable = true,
    ): Promise<boolean> => {
      const s = stateRef.current;
      if (!s) return false;
      const prev = draftOf(s);
      replace(applyDraft(s, next));
      const r = await saveArrangement(mixId, s.arrangement.version, next);
      if (r.ok) {
        const cur = stateRef.current ?? s;
        replace({ ...cur, arrangement: { ...cur.arrangement, version: r.version } });
        onSaved?.();
        if (undoable) {
          toast(message, {
            duration: TOAST_MS,
            action: {
              label: "Undo",
              onClick: () => void commit(prev, undoMessage, undoMessage, false),
            },
          });
        } else toast(message, { duration: TOAST_MS });
        return true;
      }
      if (r.conflict) {
        replace(r.state);
        toast(COPY.conflict);
      } else {
        replace(s);
        toast.error(r.message);
      }
      return false;
    },
    [mixId, replace, onSaved],
  );
  const api = useMemo<GraphApi>(() => ({ commit }), [commit]);

  const moveTo = useCallback(
    (fromKey: string, targetIndex: number) => {
      const s = stateRef.current;
      const from = nodes.find((n) => n.key === fromKey);
      const to = nodes[targetIndex];
      if (!s || !from || !to || from.key === to.key) return;
      const order = moveOriginal(lineOf(nodes), from.uri, to.uri);
      const next = { ...draftOf(s), manualOrder: order };
      const moved = buildFromState(applyDraft(s, next)).nodes.find((n) => n.key === from.key);
      void commit(next, COPY.moved((moved?.firstSlot ?? 0) + 1), COPY.moveUndone);
    },
    [nodes, commit],
  );

  // Pointer tracking for a press that may become a drag.
  useEffect(() => {
    if (!drag) return;
    const toLocal = (cx: number, cy: number) => {
      const inner = layoutRef.current?.scroller?.firstElementChild as
        HTMLElement | null | undefined;
      const r = inner?.getBoundingClientRect();
      return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (!drag.lifted) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_SLOP) {
          if (timer.current) clearTimeout(timer.current);
          setDrag(null);
        }
        return;
      }
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      const l = layoutRef.current?.l;
      const target =
        l && drag.role === "original"
          ? pickDropTarget(nodes, (i) => l.pos(i), p.x, p.y, drag.key, DROP_RADIUS)
          : -1;
      if (target !== drag.target && target >= 0) vibrate(5);
      setDrag({ ...drag, x: e.clientX, y: e.clientY, target });
      const sc = layoutRef.current?.scroller;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (e.clientY < r.top + EDGE) sc.scrollBy(0, -12);
        else if (e.clientY > r.bottom - EDGE) sc.scrollBy(0, 12);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (timer.current) clearTimeout(timer.current);
      if (drag.lifted) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
        const node = nodes.find((n) => n.key === drag.key);
        const handled = node
          ? (onDrop?.({ ...drag, x: e.clientX, y: e.clientY }, node, api) ?? false)
          : false;
        if (!handled) {
          if (drag.role === "copy") {
            vibrate(20);
            toast(COPY.ruleStays);
          } else if (drag.target >= 0) moveTo(drag.key, drag.target);
        }
      }
      setDrag(null);
    };
    const onCancel = () => {
      if (timer.current) clearTimeout(timer.current);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag, nodes, moveTo, onDrop, api]);

  const byKey = (key: string) =>
    Array.from(layoutRef.current?.scroller?.querySelectorAll<HTMLElement>("[data-key]") ?? []).find(
      (el) => el.dataset.key === key,
    );
  const focusKey = (key: string) => byKey(key)?.querySelector<HTMLButtonElement>("button")?.focus();

  const onKey = (node: GraphNode, i: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const originals = nodes.map((n, j) => (n.role === "original" ? j : -1)).filter((j) => j >= 0);
    if (kbd) {
      if (e.key === "Escape") {
        setKbd(null);
        e.preventDefault();
      } else if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp"
      ) {
        const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const pos = originals.indexOf(kbd.target);
        const nextIdx = originals[Math.max(0, Math.min(originals.length - 1, pos + dir))];
        if (nextIdx !== undefined) setKbd({ ...kbd, target: nextIdx });
        e.preventDefault();
      } else if (e.key === " ") {
        moveTo(kbd.key, kbd.target);
        setKbd(null);
        e.preventDefault();
      }
      return;
    }
    if (e.key === " " && node.role === "original") {
      setKbd({ key: node.key, target: i });
      e.preventDefault();
    } else if (e.key === " " && node.role === "copy") {
      toast(COPY.ruleStays);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      const n = nodes[i + 1];
      if (n) focusKey(n.key);
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      const n = nodes[i - 1];
      if (n) focusKey(n.key);
      e.preventDefault();
    }
  };

  const total = result?.stats.total ?? 0;
  const submitGoto = () => {
    const k = Number(goto.value);
    if (!Number.isInteger(k) || k < 1 || k > total) {
      setGoto({ ...goto, error: COPY.slotRange(total) });
      return;
    }
    const n = nodes.find((x) => k - 1 >= x.firstSlot && k - 1 < x.firstSlot + x.plays);
    if (n) {
      const el = byKey(n.key);
      el?.scrollIntoView?.({ block: "center" });
      focusKey(n.key);
    }
    setGoto({ open: false, value: "", error: null });
  };

  const liftedKey = drag?.lifted ? drag.key : (kbd?.key ?? null);
  const targetIdx = drag?.lifted ? drag.target : (kbd?.target ?? -1);
  const ghostSlot = targetIdx >= 0 ? (nodes[targetIdx]?.firstSlot ?? 0) + 1 : null;

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          className="rounded-full bg-s2 px-3 py-1 text-xs font-semibold"
          onClick={() => setGoto((g) => ({ ...g, open: !g.open, error: null }))}
        >
          Go to slot
        </button>
        {goto.open ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitGoto();
            }}
          >
            <input
              aria-label="Slot number"
              inputMode="numeric"
              autoFocus
              value={goto.value}
              onChange={(e) => setGoto({ ...goto, value: e.target.value, error: null })}
              className="w-20 rounded bg-s2 px-2 py-1 text-sm"
            />
            {goto.error ? (
              <span role="alert" className="text-xs text-err">
                {goto.error}
              </span>
            ) : null}
          </form>
        ) : null}
      </div>
      <GraphPanel
        status={status}
        error={error}
        state={state}
        result={result}
        onTap={(node, el) => {
          if (suppressClick.current || drag?.lifted) return;
          onTap?.(node, el);
        }}
        onSkipped={onSkipped}
        graphProps={{
          onLayout: (l, scroller) => (layoutRef.current = { l, scroller }),
          coverProps: (node, i) => ({
            lifted: node.key === liftedKey,
            dropTarget: i === targetIdx,
            onKeyDown: onKey(node, i),
            onPointerDown: (e) => {
              if (e.button !== 0) return;
              const d: Drag = {
                key: node.key,
                role: node.role,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                x: e.clientX,
                y: e.clientY,
                lifted: false,
                target: -1,
              };
              setDrag(d);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                vibrate(10);
                setDrag((cur) => (cur && cur.key === d.key ? { ...cur, lifted: true } : cur));
              }, LONG_PRESS_MS);
            },
            ...(drag?.lifted && node.key === drag.key
              ? {
                  style: {
                    left: (layoutRef.current?.l.pos(i).x ?? 0) + (drag.x - drag.startX),
                    top: (layoutRef.current?.l.pos(i).y ?? 0) + (drag.y - drag.startY),
                    zIndex: 30,
                    transition: "none",
                  },
                }
              : {}),
          }),
        }}
      >
        {ghostSlot !== null && liftedKey ? (
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black"
          >
            {COPY.ghost(ghostSlot)} · {COPY.dropHere}
          </div>
        ) : null}
        {extensions?.(api, drag)}
      </GraphPanel>
    </>
  );
}
