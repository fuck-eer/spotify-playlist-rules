"use client";

import type { BuildResult, GraphNode } from "@rulemix/rules-engine";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { applyDraft, draftOf, saveArrangement } from "@/lib/arrangement-client";
import {
  benchOriginal,
  deleteCopy,
  deleteRepeatPlay,
  lineOf,
  moveOriginal,
  pickDropTarget,
  restoreFromBench,
  type ArrangementDraft,
} from "@/lib/arrangement-ops";
import { BenchCluster } from "./bench-cluster";
import { BenchPanel } from "./bench-panel";
import { BenchTarget } from "./bench-target";
import type { MixState } from "@/lib/mix-state";
import { ArrangementQueue } from "@/lib/arrangement-queue";
import { safeBuildFromState } from "@/lib/use-mix-state";
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
  benched: "Benched. It won't play in this mix.",
  benchedFirst: "Benched. Tap the bench to bring it back.",
  copyDeleted: (n: number) => `Copy deleted. Rule #${n} still applies.`,
  playDeleted: (n: number) => `One play deleted. Rule #${n} still applies.`,
  startWith: "Start with plays once. Remove the rule instead.",
  backWhere: "Back where it was",
  undoFailed: "Couldn't undo. Try again.",
  backIn: (k: number) => `Back in at slot ${k}`,
};
const TARGET_SLOP = 16;
let benchedThisSession = false;
/** Test hook: forget the first-bench hint. */
export function resetBenchSession() {
  benchedThisSession = false;
}

/** What the target / popover action does for a node. */
export function removeKind(node: GraphNode): "bench" | "delete" {
  return node.role === "copy" || node.plays >= 2 ? "delete" : "bench";
}

export interface GraphActions {
  remove: (node: GraphNode) => void;
}

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
  /** Set when the drag started on a bench row (URI). */
  bench?: string | undefined;
  overTarget?: boolean | undefined;
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
  actionsRef,
  onRulesChanged,
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
  actionsRef?: React.MutableRefObject<GraphActions | null> | undefined;
  /** A save dropped a Mix rule server-side (Repeat down to 1 play). */
  onRulesChanged?: (() => void) | undefined;
}) {
  const [benchOpen, setBenchOpen] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [kbd, setKbd] = useState<{ key: string; target: number } | null>(null);
  const [goto, setGoto] = useState<{ open: boolean; value: string; error: string | null }>({
    open: false,
    value: "",
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Text for the polite live region (a zero-width space alternates so repeats re-announce). */
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback(
    (text: string) => setAnnouncement((p) => (p.endsWith("\u200b") ? text : `${text}\u200b`)),
    [],
  );
  const suppressClick = useRef(false);
  const layoutRef = useRef<{ l: GraphLayout; scroller: HTMLDivElement | null } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const nodes = useMemo(() => result?.nodes ?? [], [result]);

  /** Saves one at a time per Mix (S1); optimistic apply; a real 409 replaces with the server state. */
  const queue = useMemo(
    () =>
      new ArrangementQueue({
        get: () => stateRef.current,
        set: (next) => {
          stateRef.current = next;
          replace(next);
        },
        save: (version, draft) => saveArrangement(mixId, version, draft),
      }),
    [mixId, replace],
  );
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
      const r = await queue.commit(next);
      if (r.ok) {
        onSaved?.();
        if (message) announce(message);
        if (undoable) {
          toast(message, {
            duration: TOAST_MS,
            action: {
              label: "Undo",
              onClick: () => void commit(prev, undoMessage, undoMessage, false),
            },
          });
        } else if (message) toast(message, { duration: TOAST_MS });
        return true;
      }
      if ("conflict" in r) {
        toast(COPY.conflict);
        announce(COPY.conflict);
      } else if ("error" in r) {
        toast.error(r.error);
        announce(r.error);
      }
      return false;
    },
    [queue, onSaved, announce],
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
      const moved = (safeBuildFromState(applyDraft(s, next))?.nodes ?? []).find(
        (n) => n.key === from.key,
      );
      void commit(next, COPY.moved((moved?.firstSlot ?? 0) + 1), COPY.moveUndone);
    },
    [nodes, commit],
  );

  /** Re-adds a Mix rule the server dropped, at `index`, with its removed plays. */
  const readdRule = useCallback(
    async (rule: MixState["rules"][number], index: number) => {
      const json = { "content-type": "application/json" };
      try {
        const res = await fetch(`/api/mixes/${mixId}/rules`, {
          method: "POST",
          headers: json,
          body: JSON.stringify({ ruleId: rule.ruleId, trackUri: rule.trackUri }),
        });
        if (!res.ok) throw new Error("add failed");
        const row = ((await res.json()) as { rule: { id: string } }).rule;
        const ids = (stateRef.current?.rules ?? []).map((r) => r.id).filter((id) => id !== row.id);
        if (index < ids.length) {
          ids.splice(index, 0, row.id);
          await fetch(`/api/mixes/${mixId}/rules/order`, {
            method: "PUT",
            headers: json,
            body: JSON.stringify({ ids }),
          });
        }
        const fresh = (await (await fetch(`/api/mixes/${mixId}/state`)).json()) as MixState;
        stateRef.current = fresh;
        replace(fresh);
        const d = draftOf(fresh);
        await commit(
          {
            ...d,
            rules: d.rules.map((r) =>
              r.id === row.id ? { ...r, removedPlays: rule.removedPlays } : r,
            ),
          },
          COPY.backWhere,
          COPY.backWhere,
          false,
        );
        onRulesChanged?.();
      } catch {
        toast.error(COPY.undoFailed);
      }
    },
    [mixId, replace, commit, onRulesChanged],
  );
  const remove = useCallback(
    (node: GraphNode) => {
      const s = stateRef.current;
      if (!s) return;
      const cur = draftOf(s);
      if (node.role === "copy") {
        const ruleId = node.key.split(":")[1] ?? "";
        const rule = s.rules.find((r) => r.id === ruleId);
        if (!rule || rule.kind === "pin_first" || node.copyIndex === null) {
          vibrate(20);
          toast(COPY.startWith);
          return;
        }
        const n = s.rules.indexOf(rule) + 1;
        void commit(deleteCopy(cur, ruleId, node.copyIndex), COPY.copyDeleted(n), COPY.backWhere);
      } else if (node.plays >= 2 && node.ruleIndex !== null) {
        const rule = s.rules[node.ruleIndex];
        if (!rule) return;
        const last = node.plays === 2;
        const index = node.ruleIndex;
        const message = COPY.playDeleted(index + 1);
        void commit(
          deleteRepeatPlay(cur, rule.id),
          last ? "" : message,
          COPY.backWhere,
          !last,
        ).then((ok) => {
          if (!ok || !last) return;
          onRulesChanged?.();
          // The server dropped the Mix rule; Undo re-adds it at its place (N2).
          toast(message, {
            duration: TOAST_MS,
            action: { label: "Undo", onClick: () => void readdRule(rule, index) },
          });
        });
      } else {
        const msg = benchedThisSession ? COPY.benched : COPY.benchedFirst;
        benchedThisSession = true;
        void commit(benchOriginal(cur, node.uri), msg, COPY.backWhere);
      }
    },
    [commit, onRulesChanged, readdRule],
  );
  if (actionsRef) actionsRef.current = { remove };

  /** Restores `uri` before line position `index` (Original count). */
  const restore = useCallback(
    (uri: string, index: number) => {
      const s = stateRef.current;
      if (!s) return;
      const next = restoreFromBench(draftOf(s), uri, index, lineOf(nodes));
      const back = (safeBuildFromState(applyDraft(s, next))?.nodes ?? []).find(
        (n) => n.key === `b:${uri}`,
      );
      setBenchOpen(false);
      void commit(next, COPY.backIn((back?.firstSlot ?? 0) + 1), COPY.backWhere);
    },
    [nodes, commit],
  );
  const restoreAtSlot = (uri: string, k: number) =>
    restore(uri, nodes.filter((n) => n.role === "original" && n.firstSlot < k - 1).length);

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
      if (!drag.lifted && drag.bench) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_SLOP) {
          setBenchOpen(false);
          setDrag({ ...drag, lifted: true, x: e.clientX, y: e.clientY });
        }
        return;
      }
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
      const tr = targetRef.current?.getBoundingClientRect();
      const overTarget =
        !drag.bench &&
        !!tr &&
        e.clientX >= tr.left - TARGET_SLOP &&
        e.clientX <= tr.right + TARGET_SLOP &&
        e.clientY >= tr.top - TARGET_SLOP &&
        e.clientY <= tr.bottom + TARGET_SLOP;
      const target =
        l && drag.role === "original" && !overTarget
          ? pickDropTarget(
              nodes,
              (i) => l.pos(i),
              p.x,
              p.y,
              drag.key,
              drag.bench ? 80 : DROP_RADIUS,
            )
          : -1;
      if (target !== drag.target && target >= 0) vibrate(5);
      setDrag({ ...drag, x: e.clientX, y: e.clientY, target, overTarget });
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
        if (drag.bench) {
          const t = nodes[drag.target];
          if (t) restore(drag.bench, lineOf(nodes).indexOf(t.uri));
          setDrag(null);
          return;
        }
        if (node && drag.overTarget) {
          remove(node);
          setDrag(null);
          return;
        }
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
  }, [drag, nodes, moveTo, onDrop, api, remove, restore]);

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
    if (e.key === "Delete" || e.key === "Backspace") {
      remove(node);
      e.preventDefault();
    } else if (e.key === " " && node.role === "original") {
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
  const draggedNode =
    drag?.lifted && !drag.bench ? nodes.find((n) => n.key === drag.key) : undefined;
  const bench = state?.arrangement.bench ?? [];
  const images = Object.fromEntries(bench.map((u) => [u, state?.tracks[u]?.imageUrl ?? null]));
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
          extraHeight: bench.length > 0 ? 56 : 0,
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
                  dragOffset: { x: drag.x - drag.startX, y: drag.y - drag.startY },
                  style: {
                    left: layoutRef.current?.l.pos(i).x ?? 0,
                    top: layoutRef.current?.l.pos(i).y ?? 0,
                    zIndex: 30,
                  },
                }
              : {}),
          }),
        }}
      >
        <p aria-live="polite" className="sr-only" data-testid="graph-announcer">
          {announcement}
        </p>
        {ghostSlot !== null && liftedKey ? (
          <div
            role="status"
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black"
          >
            {COPY.ghost(ghostSlot)} · {COPY.dropHere}
          </div>
        ) : null}
        <AnimatePresence>
          {draggedNode ? (
            <BenchTarget
              key="target"
              ref={targetRef}
              kind={removeKind(draggedNode)}
              hover={!!drag?.overTarget}
            />
          ) : null}
        </AnimatePresence>
        {draggedNode ? null : (
          <BenchCluster
            bench={bench}
            images={images}
            open={benchOpen}
            onToggle={() => setBenchOpen((o) => !o)}
          />
        )}
        <AnimatePresence>
          {benchOpen && !draggedNode ? (
            <BenchPanel
              key="panel"
              rows={bench.map((u) => {
                const t = state?.tracks[u];
                return {
                  uri: u,
                  name: t?.name ?? "Unknown song",
                  artist: t?.artists.join(", ") ?? "",
                  imageUrl: t?.imageUrl ?? null,
                };
              })}
              total={total}
              onClose={() => setBenchOpen(false)}
              onRestoreEnd={(u) => restore(u, Number.MAX_SAFE_INTEGER)}
              onRestoreSlot={restoreAtSlot}
              onRowPointerDown={(u, e) => {
                if (e.button !== 0) return;
                setDrag({
                  key: `bench:${u}`,
                  role: "original",
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  x: e.clientX,
                  y: e.clientY,
                  lifted: false,
                  target: -1,
                  bench: u,
                });
              }}
            />
          ) : null}
        </AnimatePresence>
        {drag?.bench && drag.lifted ? (
          <div
            className="pointer-events-none fixed z-50 h-12 w-12 rounded-md ring-2 ring-white"
            style={{
              left: drag.x - 24,
              top: drag.y - 24,
              background: images[drag.bench] ? `center/cover url(${images[drag.bench]})` : "#555",
            }}
          />
        ) : null}
        {extensions?.(api, drag)}
      </GraphPanel>
    </>
  );
}
