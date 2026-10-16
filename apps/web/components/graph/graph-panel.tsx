"use client";

import type { BuildResult, GraphNode } from "@rulemix/rules-engine";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MixState } from "@/lib/mix-state";
import { CoverGraph, type CoverGraphProps } from "./cover-graph";
import { summaryText, type RuleMeta } from "./labels";

export const GRAPH_HINT = "Tap a song for rules. Drag to move, bench or delete.";

export function skippedLabel(n: number): string | null {
  if (n === 0) return null;
  return `${n} ${n === 1 ? "song" : "songs"} skipped (unavailable)`;
}

/** PREVIEW section: summary, hint, the cover graph and the skipped link. */
export function GraphPanel({
  status,
  error,
  state,
  result,
  onTap,
  onSkipped,
  graphProps,
  children,
}: {
  status: "loading" | "error" | "ready";
  error?: string | undefined;
  state: MixState | null;
  result: BuildResult | null;
  onTap?: ((node: GraphNode, el: HTMLElement) => void) | undefined;
  onSkipped?: (() => void) | undefined;
  graphProps?: Partial<CoverGraphProps> | undefined;
  children?: ReactNode | undefined;
}) {
  const rules: RuleMeta[] = state?.rules.map((r) => ({ kind: r.kind, n: r.n })) ?? [];
  const skipped = result ? skippedLabel(result.stats.skippedUnavailable) : null;
  return (
    <section aria-label="Preview">
      {status === "loading" && !result ? (
        <div data-testid="preview-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-sm text-err">
          {error}
        </p>
      ) : null}
      {result && state ? (
        <>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <p className="text-xs text-dim">{GRAPH_HINT}</p>
            <p aria-live="polite" className="font-mono text-xs text-mut">
              {summaryText(
                result.stats.total,
                state.rules.length,
                state.arrangement.manualOrder !== null,
              )}
            </p>
          </div>
          <div className="relative rounded-[10px] bg-s1 px-2 py-3">
            <CoverGraph
              nodes={result.nodes}
              tracks={state.tracks}
              rules={rules}
              onTap={onTap}
              {...graphProps}
            />
            {children}
          </div>
          {skipped ? (
            <button
              type="button"
              onClick={onSkipped}
              className="mt-1.5 font-mono text-xs text-dim underline underline-offset-2"
            >
              {skipped}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
