"use client";

import type { TrackItem } from "@rulemix/spotify";
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export interface SongsState {
  status: "idle" | "loading" | "ready" | "error";
  songs: TrackItem[];
  error?: string;
}

export function SongPickerSheet({
  open,
  onOpenChange,
  state,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: SongsState;
  onPick: (s: TrackItem) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? state.songs.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.artists.some((a) => a.toLowerCase().includes(needle)),
      )
    : state.songs;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl border-0 bg-s2 p-5"
      >
        <SheetTitle className="text-lg">Pick the rule&apos;s song</SheetTitle>
        <SheetDescription className="text-xs text-dim">
          Songs from this mix&apos;s source playlist.
        </SheetDescription>
        <input
          type="search"
          aria-label="Search songs"
          placeholder="Search songs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-3 w-full rounded-md bg-s3 px-3 py-2 text-sm text-tx outline-none"
        />
        <div className="mt-2 flex flex-col">
          {state.status === "loading" || state.status === "idle"
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="my-2 h-10 w-full" />)
            : null}
          {state.status === "error" ? (
            <p role="alert" className="py-4 text-sm text-err">
              {state.error ?? "Couldn't load the songs. Try again."}
            </p>
          ) : null}
          {state.status === "ready"
            ? shown.map((s) => (
                <button
                  key={s.uri}
                  type="button"
                  onClick={() => onPick(s)}
                  className="border-b border-[#222] py-2.5 text-left text-sm"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-mut"> · {s.artists.join(", ")}</span>
                </button>
              ))
            : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
