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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2Icon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { PlaybackOutcome, RunKind, SaveRunRow } from "@/lib/db/save-runs-repo";
import { MixGraph, removeKind, type GraphActions } from "@/components/graph/mix-graph";
import { SongPopover, UnavailableCard } from "@/components/graph/song-popover";
import type { GraphNode, RuleKind } from "@rulemix/rules-engine";
import { useMixState } from "@/lib/use-mix-state";
import { RuleCard } from "./rule-card";
import { RulePickerSheet, type RulesState } from "./rule-picker-sheet";
import { RulesIconLink } from "./rules-icon-link";
import { SongPickerSheet, type SongsState } from "./song-picker-sheet";
import { SourcePickerSheet, type SourcesState } from "./source-picker-sheet";

const spotifyUrl = (playlistId: string): string =>
  `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`;

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
  canAutoPlay = true,
}: {
  mix: MixRow | null;
  rules?: MixRuleRow[];
  maxRules?: number;
  addRuleId?: string | null;
  /** Stored scopes include the playback scopes (ADR-0023). */
  canAutoPlay?: boolean;
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
  const [nameInvalid, setNameInvalid] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const graphActions = useRef<GraphActions | null>(null);
  const [targetId, setTargetId] = useState<string | null>(mix?.targetPlaylistId ?? null);
  const [savedDialog, setSavedDialog] = useState(false);
  const [played, setPlayed] = useState<{ playlistId: string; playback: PlaybackOutcome } | null>(
    null,
  );
  const [rules, setRules] = useState<MixRuleRow[]>(initialRules);
  const [rulePickerOpen, setRulePickerOpen] = useState(false);
  const [library, setLibrary] = useState<RulesState>({ status: "idle", rules: [] });
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongsState>({ status: "idle", songs: [] });
  const [pendingSource, setPendingSource] = useState<SourceListItem | null>(null);
  const handledAddRule = useRef(false);
  const [keepSourceOrder, setKeepSourceOrder] = useState(mix?.keepSourceOrder ?? false);
  const [previewTick, setPreviewTick] = useState(0);
  const refreshPreview = () => setPreviewTick((t) => t + 1);
  const [runId, setRunId] = useState<string | null>(null);
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
    if (!mixId && !name.trim()) {
      setNameInvalid(true);
      nameRef.current?.focus();
      return;
    }
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
      if (keepSourceOrder) {
        // Chosen before the mix existed; the create API takes name + source only.
        const ok = await fetch(`/api/mixes/${created.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ keepSourceOrder: true }),
        });
        if (!ok.ok) toast.error(await errorMessage(ok));
      }
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

  const graph = useMixState(mixId, previewTick);
  const [tapped, setTapped] = useState<{ node: GraphNode; el: HTMLElement } | null>(null);
  const [unavailableOpen, setUnavailableOpen] = useState(false);

  /** Library rule for kind/n (created if missing), then bound to the song in this Mix. */
  /** The library Rule for kind/n, created when missing; null on failure (toasted). */
  async function resolveRuleId(kind: RuleKind, n: number | null): Promise<string | null> {
    let lib = library.status === "ready" ? library.rules : null;
    if (!lib) {
      const res = await fetch("/api/rules");
      lib = res.ok ? ((await res.json()) as { rules: RuleRow[] }).rules : [];
    }
    let ruleId = lib.find((r) => r.kind === kind && r.n === n && r.archivedAt === null)?.id;
    if (!ruleId) {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, n }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res));
        return null;
      }
      ruleId = ((await res.json()) as { rule: RuleRow }).rule.id;
      setLibrary({ status: "idle", rules: [] });
    }
    return ruleId;
  }

  async function addRuleForSong(kind: RuleKind, n: number | null, uri: string): Promise<boolean> {
    if (!mixId) return false;
    const ruleId = await resolveRuleId(kind, n);
    if (!ruleId) return false;
    const res = await fetch(`/api/mixes/${mixId}/rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ruleId, trackUri: uri }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return false;
    }
    const { rule } = (await res.json()) as { rule: MixRuleRow };
    const name = graph.state?.tracks[uri]?.name ?? null;
    setRules((rs) => [...rs, { ...rule, songName: rule.songName ?? name }]);
    refreshPreview();
    return true;
  }

  async function changeRule(mixRuleId: string, kind: RuleKind, n: number): Promise<void> {
    const r = rules.find((x) => x.id === mixRuleId);
    if (!r || !mixId) return;
    const ruleId = await resolveRuleId(kind, n);
    if (!ruleId) return;
    // In place: the rule keeps its priority position (and colour).
    const res = await fetch(`/api/mixes/${mixId}/rules/${mixRuleId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ruleId }),
    });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    const { rule } = (await res.json()) as { rule: MixRuleRow };
    setRules((rs) =>
      rs.map((x) => (x.id === mixRuleId ? { ...rule, songName: rule.songName ?? x.songName } : x)),
    );
    refreshPreview();
  }

  async function onKeepSourceOrder(next: boolean): Promise<void> {
    const prev = keepSourceOrder;
    setKeepSourceOrder(next);
    if (!mixId) return; // applied when the mix is created
    if (!(await patch({ keepSourceOrder: next }))) {
      setKeepSourceOrder(prev);
      return;
    }
    refreshPreview();
  }

  // A Repeat rule deleted server-side (down to 1 play) leaves the RULES list too.
  const serverRuleIds = graph.state?.rules.map((r) => r.id).join(",");
  const graphRulesRef = useRef(graph.state?.rules);
  graphRulesRef.current = graph.state?.rules;
  useEffect(() => {
    if (serverRuleIds === undefined) return;
    const ids = new Set(serverRuleIds ? serverRuleIds.split(",") : []);
    setRules((rs) => {
      if (rs.some((r) => !ids.has(r.id)) && ids.size < rs.length) {
        return rs.filter((r) => ids.has(r.id));
      }
      // A rule re-added by Undo (N2) comes back from the server: take the server list.
      const server = graphRulesRef.current;
      if (server && ids.size > rs.length && rs.every((r) => ids.has(r.id))) return server;
      return rs;
    });
  }, [serverRuleIds]);

  const [confirmOrder, setConfirmOrder] = useState<"reshuffle" | "reset" | null>(null);
  const hasManualOrder = graph.state?.arrangement.manualOrder != null;

  async function onResetOrder(): Promise<void> {
    if (!mixId) return;
    const res = await fetch(`/api/mixes/${mixId}/reset-order`, { method: "POST" });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    refreshPreview();
  }

  async function onReshuffle(confirmed = false): Promise<void> {
    if (!mixId) return;
    if (hasManualOrder && !confirmed) {
      setConfirmOrder("reshuffle");
      return;
    }
    const res = await fetch(`/api/mixes/${mixId}/reshuffle`, { method: "POST" });
    if (!res.ok) {
      toast.error(await errorMessage(res));
      return;
    }
    refreshPreview();
  }

  const onSave = (): Promise<void> => startRun("save");
  const onPlay = (): Promise<void> => startRun("play");

  /** Save and Play share one run at a time per Mix and one poller (ADR-0024). */
  async function startRun(kind: RunKind): Promise<void> {
    if (!mixId || saveBusy.current) return;
    saveBusy.current = true;
    setStartingSave(true);
    let started = false;
    try {
      const res = await fetch(`/api/mixes/${mixId}/${kind}`, { method: "POST" });
      if (res.status === 202 || res.status === 409) {
        const body = (await res.json()) as { runId?: string };
        if (body.runId) {
          started = true;
          setSaveRun(null);
          setRunId(body.runId);
          return;
        }
      }
      runFailed(kind, res.ok ? SAVE_FAILED_COPY : await errorMessage(res));
    } catch {
      runFailed(kind, SAVE_FAILED_COPY);
    } finally {
      if (!started) saveBusy.current = false;
      setStartingSave(false);
    }
  }

  function runFailed(kind: RunKind, message: string): void {
    toast.error(message, { action: { label: "Retry", onClick: () => void startRun(kind) } });
  }

  // Poll the run every 1 s while it is running (spec A5).
  useEffect(() => {
    if (!mixId || !runId) return;
    let stopped = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/mixes/${mixId}/save/${runId}`);
          if (stopped || !res.ok) return;
          const { run } = (await res.json()) as { run: SaveRunRow };
          if (stopped) return;
          setSaveRun(run);
          if (run.status === "running") return;
          stopped = true;
          clearInterval(timer);
          saveBusy.current = false;
          setRunId(null);
          setSaveRun(null);
          if (run.status === "succeeded" && run.kind === "play") {
            // A dialog with a real link the user taps: opening after the poll has no user
            // gesture, so phones may not hand off to the Spotify app (ADR-0022).
            if (run.playlistId) {
              setPlayed({ playlistId: run.playlistId, playback: run.playback ?? "not_started" });
            }
          } else if (run.status === "succeeded") {
            const base = `Saved "${targetName(savedName)}" to Spotify. Play it with shuffle off.`;
            toast.success(
              run.recreated ? `${base} It was recreated because the old one was gone.` : base,
            );
            router.refresh();
            void showSaved();
          } else {
            runFailed(run.kind, run.error ?? SAVE_FAILED_COPY);
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
  }, [mixId, runId]);

  async function showSaved(): Promise<void> {
    if (!mixId) return;
    try {
      const res = await fetch(`/api/mixes/${mixId}`);
      if (!res.ok) return;
      const { mix: fresh } = (await res.json()) as { mix: MixRow };
      if (fresh.targetPlaylistId) {
        setTargetId(fresh.targetPlaylistId);
        setSavedDialog(true);
      }
    } catch {
      // The toast already confirmed the save; the dialog is a shortcut only.
    }
  }

  const saving = startingSave || runId !== null;
  const unavailable = new Set(
    (graph.result?.issues ?? [])
      .filter((i) => i.kind === "rule_song_not_in_source")
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
          ref={nameRef}
          aria-label="Mix name"
          aria-invalid={nameInvalid}
          aria-describedby="mix-name-hint"
          className={`w-full border-0 border-b bg-transparent py-1 text-base font-bold text-tx outline-none ${
            nameInvalid ? "border-[#e8b04b]" : "border-line"
          }`}
          placeholder="Name this mix"
          maxLength={80}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setNameInvalid(false);
          }}
          onBlur={() => void onNameBlur()}
        />
        {name.trim() ? (
          <p id="mix-name-hint" className="mt-1.5 font-mono text-xs text-dim">
            {targetName(name.trim())}
          </p>
        ) : (
          <p
            id="mix-name-hint"
            className={`mt-1.5 text-xs ${nameInvalid ? "font-semibold text-[#e8b04b]" : "text-dim"}`}
          >
            Name your mix to pick a source
          </p>
        )}
        {targetId ? (
          <a
            href={spotifyUrl(targetId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center rounded-full bg-s2 px-4 py-2 text-sm font-semibold text-tx"
          >
            Open in Spotify
          </a>
        ) : null}
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
          {busy ? (
            <span role="status" aria-label="Creating mix" className="text-mut">
              <Loader2Icon className="size-4 animate-spin" />
            </span>
          ) : null}
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
            <MixGraph
              mixId={mixId}
              status={graph.status}
              error={graph.error}
              state={graph.state}
              result={graph.result}
              replace={graph.replace}
              onTap={(node, el) => setTapped({ node, el })}
              onSkipped={() => setUnavailableOpen(true)}
              actionsRef={graphActions}
              onRulesChanged={() => void graph.reload()}
            />
            {hasManualOrder ? (
              <button
                type="button"
                onClick={() => setConfirmOrder("reset")}
                className="mt-2 rounded-full bg-s2 px-3 py-1 text-xs font-semibold"
              >
                Reset to rule order
              </button>
            ) : null}
            {tapped && graph.state ? (
              <SongPopover
                uri={tapped.node.uri}
                track={graph.state.tracks[tapped.node.uri]}
                anchor={tapped.el}
                shiftedFrom={tapped.node.shiftedFrom}
                songRules={rules
                  .map((r, index) => ({
                    mixRuleId: r.id,
                    index,
                    kind: r.kind,
                    n: r.n,
                    uri: r.trackUri,
                  }))
                  .filter((r) => r.uri === tapped.node.uri)}
                ruleCount={rules.length}
                maxRules={maxRules}
                onAdd={(kind, n) => void addRuleForSong(kind, n, tapped.node.uri)}
                onRemove={(id) => {
                  const r = rules.find((x) => x.id === id);
                  if (r) void onRemove(r);
                }}
                onChange={(id, kind, n) => void changeRule(id, kind, n)}
                onClose={() => setTapped(null)}
                footer={(() => {
                  const node = tapped.node;
                  const pin =
                    node.role === "copy" &&
                    rules.find((r) => r.id === node.key.split(":")[1])?.kind === "pin_first";
                  if (pin) return null;
                  return (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-full bg-s1 px-3 py-2 text-sm font-semibold"
                      onClick={() => {
                        setTapped(null);
                        graphActions.current?.remove(node);
                      }}
                    >
                      {removeKind(node) === "bench" ? "Move to bench" : "Delete this copy"}
                    </button>
                  );
                })()}
              />
            ) : null}
            {unavailableOpen && graph.result ? (
              <UnavailableCard
                count={graph.result.stats.skippedUnavailable}
                onClose={() => setUnavailableOpen(false)}
              />
            ) : null}
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
        {mixId || name.trim() ? (
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
                {keepSourceOrder || !mixId ? null : (
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
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onPlay()}
              className="flex-1 rounded-full bg-[#1DB954] px-5 py-3.5 text-[15px] font-bold text-black disabled:opacity-60"
            >
              Play
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave()}
              className="rounded-full bg-s2 px-5 py-3.5 text-[15px] font-semibold text-tx disabled:opacity-60"
            >
              Save to Spotify
            </button>
          </div>
          {canAutoPlay ? null : (
            <a
              href="/api/auth/login"
              className="mt-2 block text-xs font-semibold text-tx underline"
            >
              Log in again to enable auto-play
            </a>
          )}
          <p className="mt-2 font-mono text-[11px] text-dim">
            Play with shuffle off. Saving while it&apos;s playing may skip ahead.
          </p>
        </div>
      ) : null}
      <Dialog open={savedDialog} onOpenChange={setSavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved to Spotify</DialogTitle>
            <DialogDescription>
              {targetName(savedName)} is ready. Play it with shuffle off.
            </DialogDescription>
          </DialogHeader>
          {targetId ? (
            <>
              <a
                href={spotifyUrl(targetId)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-sm text-tx underline"
              >
                {spotifyUrl(targetId).replace("https://", "")}
              </a>
              <DialogFooter>
                <a
                  href={spotifyUrl(targetId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#1DB954] px-5 py-3 text-center text-[15px] font-bold text-black"
                >
                  Open in Spotify
                </a>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={played !== null}
        onOpenChange={(o) => {
          if (!o) setPlayed(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {played?.playback === "started" ? "Playing on Spotify" : "rulemix player is ready"}
            </DialogTitle>
            <DialogDescription>
              {played?.playback === "started"
                ? "rulemix player is playing with shuffle off."
                : "Open it in Spotify and press play, with shuffle off."}
            </DialogDescription>
          </DialogHeader>
          {played ? (
            <DialogFooter>
              <a
                href={spotifyUrl(played.playlistId)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[#1DB954] px-5 py-3 text-center text-[15px] font-bold text-black"
              >
                Open in Spotify
              </a>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
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
      <AlertDialog
        open={confirmOrder !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmOrder(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmOrder === "reset"
                ? "Reset to rule order?"
                : "Reshuffle and clear your order?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your own order is cleared. The bench and deleted copies stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const which = confirmOrder;
                setConfirmOrder(null);
                if (which === "reset") void onResetOrder();
                else void onReshuffle(true);
              }}
            >
              {confirmOrder === "reset" ? "Reset" : "Reshuffle"}
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
