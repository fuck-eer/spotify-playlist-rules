"use client";

import { build, type BuildResult } from "@rulemix/rules-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MixState } from "./mix-state";

export type MixStateStatus =
  | { status: "loading"; state: null; error?: undefined }
  | { status: "error"; state: MixState | null; error: string }
  | { status: "ready"; state: MixState; error?: undefined };

/** Builds the graph input from the server state (same mapping as the server's buildForMix). */
export function buildFromState(s: MixState): BuildResult {
  return build({
    source: s.source,
    rules: s.rules.map((r) => ({
      id: r.id,
      kind: r.kind,
      n: r.n,
      uri: r.trackUri,
      removedPlays: r.removedPlays,
      deletedCopies: r.deletedCopies,
    })),
    keepSourceOrder: s.mix.keepSourceOrder,
    seed: s.mix.shuffleSeed,
    manualOrder: s.arrangement.manualOrder,
    bench: s.arrangement.bench,
  });
}

export const BUILD_FAILED = "This mix couldn't be built. Try reloading.";

/** buildFromState, or null when the engine rejects the state (never crashes the editor). */
export function safeBuildFromState(s: MixState): BuildResult | null {
  try {
    return buildFromState(s);
  } catch (e) {
    console.error("[mix] build failed", e);
    return null;
  }
}

/** GET /api/mixes/{id}/state, built locally; refetches on window focus and on `tick`. */
export function useMixState(mixId: string | null, tick = 0) {
  const [s, setS] = useState<MixStateStatus>({ status: "loading", state: null });
  const req = useRef(0);

  const reload = useCallback(async () => {
    if (!mixId) return;
    const id = ++req.current;
    try {
      const res = await fetch(`/api/mixes/${mixId}/state`);
      if (id !== req.current) return;
      if (!res.ok) {
        let msg = "Couldn't build the preview. Try again.";
        try {
          msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? msg;
        } catch {
          // keep default
        }
        setS((p) => ({ status: "error", state: p.state, error: msg }));
        return;
      }
      const state = (await res.json()) as MixState;
      if (id === req.current) setS({ status: "ready", state });
    } catch {
      if (id === req.current) {
        setS((p) => ({
          status: "error",
          state: p.state,
          error: "Couldn't build the preview. Try again.",
        }));
      }
    }
  }, [mixId]);

  useEffect(() => {
    void reload();
  }, [reload, tick]);

  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const result = useMemo(() => (s.state ? safeBuildFromState(s.state) : null), [s.state]);
  const replace = useCallback((state: MixState) => setS({ status: "ready", state }), []);
  if (s.state && !result) {
    return {
      status: "error" as const,
      state: s.state,
      error: BUILD_FAILED,
      result,
      reload,
      replace,
    };
  }
  return { ...s, result, reload, replace };
}
