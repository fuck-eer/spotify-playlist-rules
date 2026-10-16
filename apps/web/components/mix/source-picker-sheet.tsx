"use client";

import type { SourceListItem } from "@/lib/sources-types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CoverTile } from "./cover-tile";

export interface SourcesState {
  status: "idle" | "loading" | "ready" | "error";
  sources: SourceListItem[];
  maxSourceTracks: number;
}

export function SourcePickerSheet({
  open,
  onOpenChange,
  state,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: SourcesState;
  onPick: (s: SourceListItem) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl border-0 bg-s2 p-5"
      >
        <SheetTitle className="text-lg">Pick a source</SheetTitle>
        <SheetDescription className="text-xs text-dim">
          Your playlists, collabs or Liked Songs.
        </SheetDescription>
        <div className="mt-2 flex flex-col">
          {state.status === "loading" || state.status === "idle"
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="my-2 h-14 w-full" />)
            : null}
          {state.status === "error" ? (
            <p role="alert" className="py-4 text-sm text-err">
              Couldn&apos;t load your playlists. Try again.
            </p>
          ) : null}
          {state.status === "ready"
            ? state.sources.map((s) => (
                <button
                  key={s.id ?? "liked"}
                  type="button"
                  disabled={s.tooLarge}
                  onClick={() => onPick(s)}
                  className="flex items-center gap-3 rounded-md py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CoverTile seed={s.id ?? "liked"} imageUrl={s.imageUrl} />
                  <span className="flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-xs text-mut">
                      {s.tooLarge
                        ? `${s.trackCount} songs · over the ${state.maxSourceTracks} limit`
                        : `${s.trackCount} songs`}
                    </span>
                  </span>
                </button>
              ))
            : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
