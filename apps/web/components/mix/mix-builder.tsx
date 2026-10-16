"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrackItem } from "@rulemix/spotify";
import { Reorder } from "motion/react";
import { useEffect, useRef, useState } from "react";
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
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import type { MixRow, MixSource } from "@/lib/db/mixes-repo";
import type { RuleRow } from "@/lib/db/rules-repo";
import type { SourceListItem } from "@/lib/sources-types";
import { CoverTile } from "./cover-tile";
import { targetName } from "@rulemix/spotify/names";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import type { SaveRunRow } from "@/lib/db/save-runs-repo";
import type { PreviewResponse } from "@/lib/preview";
import { PreviewPanel, type PreviewState } from "./preview-panel";
import { RuleCard } from "./rule-card";
import { RulePickerSheet, type RulesState } from "./rule-picker-sheet";
import { RulesIconLink } from "./rules-icon-link";
import { SongPickerSheet, type SongsState } from "./song-picker-sheet";
import { SourcePickerSheet, type SourcesState } from "./source-picker-sheet";

const SAVE_FAILED_COPY = "Couldn't create the playlist. Check your connection and retry.";

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

export function MixBuilder({
  mix,
  rules: initialRules = [],
  maxRules = 10,
  addRuleId = null,
}: {
  mix: MixRow | null;
  rules?: MixRuleRow[];
  maxRules?: number;
  addRuleId?: string | null;
}) {
  const router = useRouter();
  const [mixId, setMixId] = useState<string | null>(mix?.id ?? null);
  const [name, setName] = useState(mix?.name ?? "");
  const [savedName, setSavedName] = useState(mix?.name ?? "");
  const [source, setSource] = useState<MixSource | null>(mix?.source ?? null);
  const [trackCount, setTrackCount] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<MixRuleRow[]>(initialRules);
  const [rulePickerOpen, setRulePickerOpen] = useState(false);
  const [library, setLibrary] = useState<RulesState>({ status: "idle", rules: [] });
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongsState>({ status: "idle", songs: [] });
  const [pendingSource, setPendingSource] = useState<SourceListItem | null>(null);
  const handledAddRule = useRef(false);
  const [keepSourceOrder, setKeepSourceOrder] = useState(mix?.keepSourceOrder ?? false);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", data: null });
  const [previewTick, setPreviewTick] = useState(0);
  const previewReq = useRef(0);
  const refreshPreview = () => setPreviewTick((t) => t + 1);
  const [saveRunId, setSaveRunId] = useState<string | null>(null);
  const [saveRun, setSaveRun] = useState<SaveRunRow | null>(null);
  const [startingSave, setStartingSave] = useState(false);
  // Ref guard: the toast's Retry closure outlives the render that created it.
  const saveBusy = useRef(false);
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
      // Point the URL at the new mix without a server navigation: a slow or
      // interrupted router.replace left the URL on /mixes/new, so a reload in
      // that window (Next dev's full reload after compiling /mixes/[id]) wiped
      // the form and orphaned the mix. Next syncs native history with its router.
      window.history.replaceState(null, "", `/mixes/${created.id}`);
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

  function onPick(s: SourceListItem): void {
    if (s.tooLarge) return;
    setPickerOpen(false);
    const changes = !source || source.type !== s.type || source.id !== s.id;
    if (mixId && changes && rules.length > 0) {
      setPendingSource(s);
      return;
    }
    void applySource(s);
  }

  async function applySource(s: SourceListItem): Promise<void> {
    const next: MixSource = { type: s.type, id: s.id, name: s.name };
    const prev = source;
    setSource(next);
    setTrackCount(s.trackCount);
    const trimmed = name.trim();
    if (!mixId) {
      if (trimmed) await create(trimmed, next);
      return;
    }
    const changed = !prev || prev.type !== next.type || prev.id !== next.id;
    if (!(await patch({ source: { type: next.type, id: next.id } }))) {
      setSource(prev);
      return;
    }
    if (changed) {
      setRules([]);
      setSongs({ status: "idle", songs: [] });
    }
    refreshPreview();
  }

  async function loadLibrary(): Promise<void> {
    setLibrary((l) => ({ ...l, status: "loading" }));
    try {
      const res = await fetch("/api/rules");
      if (!res.ok) throw new Error(await errorMessage(res));
      setLibrary({ status: "ready", rules: ((await res.json()) as { rules: RuleRow[] }).rules });
    } catch {
      setLibrary((l) => ({ ...l, status: "error" }));
    }
  }

  async function loadSongs(id: string): Promise<void> {
    setSongs((x) => ({ ...x, status: "loading" }));
    const res = await fetch(`/api/mixes/${id}/songs`);
    if (!res.ok) {
      setSongs({ status: "error", songs: [], error: await errorMessage(res) });
      return;
    }
    setSongs({ status: "ready", songs: ((await res.json()) as { songs: TrackItem[] }).songs });
  }

  function openSongPicker(ruleId: string): void {
    if (!mixId) return;
    setPendingRuleId(ruleId);
    if (songs.status !== "ready") void loadSongs(mixId);
  }

  function openRulePicker(): void {
    setRulePickerOpen(true);
    if (library.status !== "ready") void loadLibrary();
  }

  async function onPickSong(t: TrackItem): Promise<void> {
    const ruleId = pendingRuleId;
    setPendingRuleId(null);
    if (!mixId || !ruleId) return;
    const res = await fetch(`/api/mixes/${mixId}/rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ruleId, trackUri: t.uri }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    const { rule } = (await res.json()) as { rule: MixRuleRow };
    setRules((rs) => [...rs, { ...rule, songName: rule.songName ?? t.name }]);
    refreshPreview();
  }

  async function saveOrder(next: MixRuleRow[], prev: MixRuleRow[]): Promise<void> {
    if (!mixId) return;
    const res = await fetch(`/api/mixes/${mixId}/rules/order`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: next.map((r) => r.id) }),
    });
    if (!res.ok) {
      setRules(prev);
      toast.error(await errorMessage(res));
      return;
    }
    refreshPreview();
  }

  const dragStart = useRef<MixRuleRow[] | null>(null);
  function onReorder(next: MixRuleRow[]): void {
    dragStart.current ??= rules;
    setRules(next);
  }
  function onDragEnd(): void {
    const prev = dragStart.current;
    dragStart.current = null;
    if (!prev || prev.map((r) => r.id).join() === rules.map((r) => r.id).join()) return;
    void saveOrder(rules, prev);
  }

  function onMove(r: MixRuleRow, delta: -1 | 1): void {
    const i = rules.findIndex((x) => x.id === r.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setRules(next);
    void saveOrder(next, rules);
  }

  async function onRemove(r: MixRuleRow): Promise<void> {
    if (!mixId) return;
    const prev = rules;
    setRules(rules.filter((x) => x.id !== r.id));
    const res = await fetch(`/api/mixes/${mixId}/rules/${r.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRules(prev);
      toast.error(await errorMessage(res));
      return;
    }
    refreshPreview();
  }

  async function loadPreview(id: string): Promise<void> {
    const reqId = ++previewReq.current;
    setPreview((p) => ({ ...p, status: "loading" }));
    try {
      const res = await fetch(`/api/mixes/${id}/preview`);
      if (reqId !== previewReq.current) return;
      if (!res.ok) {
        setPreview({ status: "error", data: null, error: await errorMessage(res) });
        return;
      }
      const data = (await res.json()) as PreviewResponse;
      if (reqId === previewReq.current) setPreview({ status: "ready", data });
    } catch {
      if (reqId === previewReq.current) setPreview({ status: "error", data: null });
    }
  }

  // First load is immediate; later changes are debounced by 300ms.
  useEffect(() => {
    if (!mixId) return;
    if (previewTick === 0) {
      void loadPreview(mixId);
      return;
    }
    const t = setTimeout(() => void loadPreview(mixId), 300);
    return () => clearTimeout(t);
  }, [mixId, previewTick]);

  async function onKeepSourceOrder(next: boolean): Promise<void> {
    const prev = keepSourceOrder;
    setKeepSourceOrder(next);
    if (!(await patch({ keepSourceOrder: next }))) {
      setKeepSourceOrder(prev);
      return;
    }
    refreshPreview();
  }

  async function onReshuffle(): Promise<void> {
    if (!mixId) return;
    const res = await fetch(`/api/mixes/${mixId}/reshuffle`, { method: "POST" });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    refreshPreview();
  }

  async function onSave(): Promise<void> {
    if (!mixId || saveBusy.current) return;
    saveBusy.current = true;
    setStartingSave(true);
    let started = false;
    try {
      const res = await fetch(`/api/mixes/${mixId}/save`, { method: "POST" });
      if (res.status === 202 || res.status === 409) {
        const body = (await res.json()) as { runId?: string };
        if (body.runId) {
          started = true;
          setSaveRun(null);
          setSaveRunId(body.runId);
          return;
        }
      }
      saveFailed(res.ok ? SAVE_FAILED_COPY : await errorMessage(res));
    } catch {
      saveFailed(SAVE_FAILED_COPY);
    } finally {
      if (!started) saveBusy.current = false;
      setStartingSave(false);
    }
  }

  function saveFailed(message: string): void {
    toast.error(message, { action: { label: "Retry", onClick: () => void onSave() } });
  }

  // Poll the run every 1 s while it is running (spec A5).
  useEffect(() => {
    if (!mixId || !saveRunId) return;
    let stopped = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/mixes/${mixId}/save/${saveRunId}`);
          if (stopped || !res.ok) return;
          const { run } = (await res.json()) as { run: SaveRunRow };
          if (stopped) return;
          setSaveRun(run);
          if (run.status === "running") return;
          stopped = true;
          clearInterval(timer);
          saveBusy.current = false;
          setSaveRunId(null);
          setSaveRun(null);
          if (run.status === "succeeded") {
            const base = `Saved "${targetName(savedName)}" to Spotify. Play it with shuffle off.`;
            toast.success(
              run.recreated ? `${base} It was recreated because the old one was gone.` : base,
            );
            router.refresh();
          } else {
            saveFailed(run.error ?? SAVE_FAILED_COPY);
          }
        } catch {
          // A missed poll is retried on the next tick.
        }
      })();
    }, 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one poller per run; savedName/router changes must not restart it
  }, [mixId, saveRunId]);

  const saving = startingSave || saveRunId !== null;
  const unavailable = new Set(
    (preview.data?.issues ?? [])
      .filter((i) => i.kind === "unavailable_rule_song")
      .map((i) => i.ruleIndex),
  );

  useEffect(() => {
    if (!addRuleId || !mixId || handledAddRule.current) return;
    handledAddRule.current = true;
    openSongPicker(addRuleId);
    router.replace(`/mixes/${mixId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the ?addRule handoff from the rule editor
  }, [addRuleId, mixId]);

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
        {mixId ? (
          <>
            <div className="mb-2 mt-5 font-mono text-[11px] font-semibold tracking-[.12em] text-mut">
              PREVIEW
            </div>
            <PreviewPanel state={preview} onRegenerate={() => void loadPreview(mixId)} />
          </>
        ) : null}
        <div className="mb-2 mt-5 font-mono text-[11px] font-semibold tracking-[.12em] text-mut">
          RULES
        </div>
        {rules.length === 0 ? (
          <p className="py-2 text-sm text-mut">No rules yet. Without one, you just get a copy.</p>
        ) : (
          <Reorder.Group axis="y" values={rules} onReorder={onReorder} className="relative">
            {rules.map((r, i) => (
              <RuleCard
                key={r.id}
                rule={r}
                index={i}
                onRemove={(x) => void onRemove(x)}
                onMove={onMove}
                onDragEnd={onDragEnd}
                unavailable={unavailable.has(i)}
              />
            ))}
          </Reorder.Group>
        )}
        {mixId ? (
          rules.length >= maxRules ? (
            <p className="mt-1.5 text-xs text-dim">Up to {maxRules} rules per mix.</p>
          ) : (
            <button
              type="button"
              onClick={openRulePicker}
              className="mt-1 w-full rounded-lg border border-dashed border-[#444] p-3 font-semibold text-mut"
            >
              + Add rule
            </button>
          )
        ) : null}
        <p className="mt-1.5 text-xs text-dim">Drag to reorder. The top rule wins a conflict.</p>
        {mixId ? (
          <>
            <div className="mb-2 mt-5 font-mono text-[11px] font-semibold tracking-[.12em] text-mut">
              OPTIONS
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <div className="flex-1">
                <div id="keep-base-order" className="font-semibold">
                  Keep base order
                </div>
                <p className="mt-1.5 text-xs text-dim">
                  Off reshuffles the base list once before rules run.
                </p>
                {keepSourceOrder ? null : (
                  <button
                    type="button"
                    onClick={() => void onReshuffle()}
                    className="mt-1.5 text-sm font-semibold text-tx underline"
                  >
                    Reshuffle
                  </button>
                )}
              </div>
              <Switch
                aria-labelledby="keep-base-order"
                className="data-[state=checked]:bg-tx"
                checked={keepSourceOrder}
                onCheckedChange={(v) => void onKeepSourceOrder(v)}
              />
            </div>
          </>
        ) : null}
      </div>
      {mixId ? (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl border-t border-line bg-bg px-4 pb-6 pt-3.5">
          {saving ? (
            <div className="mb-3">
              <Progress
                value={saveRun && saveRun.total > 0 ? (saveRun.done / saveRun.total) * 100 : 0}
                className="bg-s3 [&>[data-slot=progress-indicator]]:bg-tx"
              />
              <p className="mt-1.5 font-mono text-xs text-mut">
                {saveRun
                  ? `${saveRun.phase === "reading" ? "Reading" : "Writing"} ${saveRun.done}/${saveRun.total}`
                  : "Starting…"}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="w-full rounded-full bg-[#1DB954] px-5 py-3.5 text-[15px] font-bold text-black disabled:opacity-60"
          >
            Save to Spotify
          </button>
          <p className="mt-2 font-mono text-[11px] text-dim">
            Play with shuffle off. Saving while it&apos;s playing may skip ahead.
          </p>
        </div>
      ) : null}
      <SourcePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        state={sources}
        onPick={onPick}
      />
      {mixId ? (
        <RulePickerSheet
          open={rulePickerOpen}
          onOpenChange={setRulePickerOpen}
          state={library}
          mixId={mixId}
          onPick={(r) => {
            setRulePickerOpen(false);
            openSongPicker(r.id);
          }}
        />
      ) : null}
      <SongPickerSheet
        open={pendingRuleId !== null}
        onOpenChange={(o) => {
          if (!o) setPendingRuleId(null);
        }}
        state={songs}
        onPick={(t) => void onPickSong(t)}
      />
      <AlertDialog
        open={pendingSource !== null}
        onOpenChange={(o) => {
          if (!o) setPendingSource(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change source?</AlertDialogTitle>
            <AlertDialogDescription>This clears the rules in this mix.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const s = pendingSource;
                setPendingSource(null);
                if (s) void applySource(s);
              }}
            >
              Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
