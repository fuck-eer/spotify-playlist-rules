"use client";

import { previewToDots } from "@/components/dots/collapse-preview";
import { DotLine } from "@/components/dots/dot-line";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PreviewResponse } from "@/lib/preview";

export interface PreviewState {
  status: "idle" | "loading" | "ready" | "error";
  data: PreviewResponse | null;
  error?: string;
}

/** Renders build() output as-is: no ordering logic lives here. */
export function PreviewPanel({
  state,
  onRegenerate,
}: {
  state: PreviewState;
  onRegenerate: () => void;
}) {
  const { data } = state;
  return (
    <section aria-label="Preview">
      {state.status === "loading" || (state.status === "idle" && !data) ? (
        <div data-testid="preview-skeleton" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-err">
          {state.error ?? "Couldn't build the preview. Try again."}
        </p>
      ) : null}
      {state.status === "ready" && data ? (
        <>
          <p className="mb-2 font-mono text-xs text-mut">{data.summary}</p>
          <div className="rounded-[10px] bg-s1 px-3 py-3.5">
            <DotLine
              items={previewToDots(data.slots, data.names, data.kinds)}
              maxDots={22}
              totalCount={data.stats.total}
              ariaLabel={data.summary}
            />
          </div>
          {data.skippedText ? (
            <p className="mt-1.5 font-mono text-xs text-dim">{data.skippedText}</p>
          ) : null}
        </>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2"
        disabled={state.status === "loading"}
        onClick={onRegenerate}
      >
        Regenerate
      </Button>
    </section>
  );
}
