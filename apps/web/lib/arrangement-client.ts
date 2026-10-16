import type { ArrangementDraft } from "./arrangement-ops";
import type { MixState } from "./mix-state";

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; state: MixState }
  | { ok: false; conflict: false; message: string };

/** PUT the arrangement with the version it was based on (409 → the server's current state). */
export async function saveArrangement(
  mixId: string,
  version: number,
  next: ArrangementDraft,
): Promise<SaveResult> {
  const res = await fetch(`/api/mixes/${mixId}/arrangement`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version, ...next }),
  });
  if (res.ok) return { ok: true, version: ((await res.json()) as { version: number }).version };
  if (res.status === 409) {
    return { ok: false, conflict: true, state: ((await res.json()) as { state: MixState }).state };
  }
  let message = "Couldn't save your order. Try again.";
  try {
    message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? message;
  } catch {
    // keep default
  }
  return { ok: false, conflict: false, message };
}

/** The draft currently stored in a state. */
export function draftOf(s: MixState): ArrangementDraft {
  return {
    manualOrder: s.arrangement.manualOrder,
    bench: s.arrangement.bench,
    rules: s.rules.map((r) => ({
      id: r.id,
      removedPlays: r.removedPlays,
      deletedCopies: r.deletedCopies,
    })),
  };
}

/** A state with `next` applied locally (optimistic). */
export function applyDraft(
  s: MixState,
  next: ArrangementDraft,
  version = s.arrangement.version,
): MixState {
  const byId = new Map(next.rules.map((r) => [r.id, r]));
  return {
    ...s,
    arrangement: { manualOrder: next.manualOrder, bench: next.bench, version },
    rules: s.rules.map((r) => {
      const d = byId.get(r.id);
      return d ? { ...r, removedPlays: d.removedPlays, deletedCopies: d.deletedCopies } : r;
    }),
  };
}
