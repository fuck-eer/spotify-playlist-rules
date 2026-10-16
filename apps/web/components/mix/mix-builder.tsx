"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MixRow, MixSource } from "@/lib/db/mixes-repo";
import type { SourceListItem } from "@/lib/sources-types";
import { CoverTile } from "./cover-tile";
import { RulesIconLink } from "./rules-icon-link";
import { SourcePickerSheet, type SourcesState } from "./source-picker-sheet";

interface ApiError {
  error?: { message?: string };
}

async function errorMessage(res: Response): Promise<string> {
  try {
    return ((await res.json()) as ApiError).error?.message ?? "Something went wrong. Try again.";
  } catch {
    return "Something went wrong. Try again.";
  }
}

export function MixBuilder({ mix }: { mix: MixRow | null }) {
  const router = useRouter();
  const [mixId, setMixId] = useState<string | null>(mix?.id ?? null);
  const [name, setName] = useState(mix?.name ?? "");
  const [savedName, setSavedName] = useState(mix?.name ?? "");
  const [source, setSource] = useState<MixSource | null>(mix?.source ?? null);
  const [trackCount, setTrackCount] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<SourcesState>({
    status: "idle",
    sources: [],
    maxSourceTracks: 0,
  });

  async function loadSources(): Promise<void> {
    setSources((s) => ({ ...s, status: "loading" }));
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = (await res.json()) as { sources: SourceListItem[]; maxSourceTracks: number };
      setSources({ status: "ready", ...body });
    } catch {
      setSources((s) => ({ ...s, status: "error" }));
    }
  }

  function openPicker(): void {
    setPickerOpen(true);
    if (sources.status !== "ready") void loadSources();
  }

  async function create(n: string, s: MixSource): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/mixes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, source: { type: s.type, id: s.id } }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res));
        return;
      }
      const { mix: created } = (await res.json()) as { mix: { id: string } };
      setMixId(created.id);
      setSavedName(n);
      router.replace(`/mixes/${created.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!mixId) return false;
    const res = await fetch(`/api/mixes/${mixId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) toast.error(await errorMessage(res));
    return res.ok;
  }

  async function onPick(s: SourceListItem): Promise<void> {
    if (s.tooLarge) return;
    setPickerOpen(false);
    const next: MixSource = { type: s.type, id: s.id, name: s.name };
    const prev = source;
    setSource(next);
    setTrackCount(s.trackCount);
    const trimmed = name.trim();
    if (!mixId) {
      if (trimmed) await create(trimmed, next);
      return;
    }
    if (!(await patch({ source: { type: next.type, id: next.id } }))) setSource(prev);
  }

  async function onNameBlur(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === savedName) return;
    if (!mixId) {
      if (source) await create(trimmed, source);
      return;
    }
    if (await patch({ name: trimmed })) setSavedName(trimmed);
  }

  async function onDelete(): Promise<void> {
    if (!mixId) return;
    const res = await fetch(`/api/mixes/${mixId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    router.replace("/mixes");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col bg-bg text-tx">
      <div className="h-10 flex-none" />
      <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-1.5">
        <Link
          href="/mixes"
          aria-label="Back"
          className="grid size-[38px] place-items-center rounded-full bg-s2"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-[18px]"
          >
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </Link>
        <h2 className="flex-1 truncate text-[17px] font-bold">{savedName}</h2>
        {mixId ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More"
              className="grid size-[38px] place-items-center rounded-full bg-s2 text-lg"
            >
              ⋯
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                Delete mix
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <RulesIconLink />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <input
          aria-label="Mix name"
          className="w-full border-0 border-b border-line bg-transparent py-1 text-base font-bold text-tx outline-none"
          placeholder="Name this mix"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void onNameBlur()}
        />
        <div className="mb-2 mt-5 font-mono text-[11px] font-semibold tracking-[.12em] text-mut">
          SOURCE
        </div>
        <button
          type="button"
          aria-label={source ? `Source: ${source.name}. Change source` : "Pick a source"}
          onClick={openPicker}
          className="flex w-full items-center gap-3 rounded-lg bg-s1 p-2.5 text-left"
        >
          <CoverTile seed={source?.id ?? (source ? "liked" : "none")} />
          <span className="flex-1 font-semibold">
            {source
              ? trackCount === null
                ? source.name
                : `${source.name} · ${trackCount} songs`
              : "Pick a source"}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="#b3b3b3"
            strokeWidth="2"
          >
            <path d="M8 4l6 6-6 6" />
          </svg>
        </button>
        <p className="mt-1.5 text-xs text-dim">Your playlists, collabs or Liked Songs.</p>
        <p className="mt-1.5 text-xs text-dim">
          Discover Weekly and other Spotify-made lists need a copy in your library first.
        </p>
        <div className="mb-2 mt-5 font-mono text-[11px] font-semibold tracking-[.12em] text-mut">
          RULES
        </div>
        {/* Ticket 10 fills the Rule Set here. */}
        <div data-testid="rules-placeholder" />
      </div>
      <SourcePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        state={sources}
        onPick={(s) => void onPick(s)}
      />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this mix?</AlertDialogTitle>
            <AlertDialogDescription>Its Spotify playlist stays.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
