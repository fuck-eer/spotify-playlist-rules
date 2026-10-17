import { describe, expect, it } from "vitest";
import { applyDraft, type SaveResult } from "./arrangement-client";
import { ArrangementQueue } from "./arrangement-queue";
import type { ArrangementDraft } from "./arrangement-ops";
import type { MixState } from "./mix-state";

const S = (version: number, bench: string[] = []): MixState =>
  ({
    mix: { id: "m" },
    rules: [],
    source: [],
    tracks: {},
    arrangement: { manualOrder: null, bench, version },
  }) as unknown as MixState;
const D = (bench: string[]): ArrangementDraft => ({ manualOrder: null, bench, rules: [] });

function harness() {
  let state = S(5);
  const calls: { version: number; draft: ArrangementDraft; resolve: (r: SaveResult) => void }[] =
    [];
  const q = new ArrangementQueue({
    get: () => state,
    set: (s) => (state = s),
    save: (version, draft) =>
      new Promise<SaveResult>((resolve) => calls.push({ version, draft, resolve })),
  });
  const edit = (bench: string[]) => q.commit(D(bench));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { q, calls, edit, tick, state: () => state };
}

describe("ArrangementQueue (S1)", () => {
  it("two edits before the first response: saved one at a time, each on the previous version, no conflict", async () => {
    const h = harness();
    const a = h.edit(["a"]);
    const b = h.edit(["a", "b"]);
    expect(h.state().arrangement.bench).toEqual(["a", "b"]); // both optimistic
    await h.tick();
    expect(h.calls).toHaveLength(1); // second waits for the first
    expect(h.calls[0]!.version).toBe(5);
    h.calls[0]!.resolve({ ok: true, version: 6 });
    expect(await a).toEqual({ ok: true });
    await h.tick();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]!.version).toBe(6);
    expect(h.calls[1]!.draft.bench).toEqual(["a", "b"]);
    h.calls[1]!.resolve({ ok: true, version: 7 });
    expect(await b).toEqual({ ok: true });
    expect(h.state().arrangement).toMatchObject({ bench: ["a", "b"], version: 7 });
  });

  it("a failure restores the last confirmed state and drops queued edits", async () => {
    const h = harness();
    const a = h.edit(["a"]);
    const b = h.edit(["a", "b"]);
    const c = h.edit(["a", "b", "c"]);
    await h.tick();
    h.calls[0]!.resolve({ ok: true, version: 6 });
    await a;
    await h.tick();
    h.calls[1]!.resolve({ ok: false, conflict: false, message: "nope" });
    expect(await b).toEqual({ ok: false, error: "nope" });
    expect(await c).toEqual({ ok: false, cancelled: true });
    expect(h.calls).toHaveLength(2);
    expect(h.state().arrangement).toMatchObject({ bench: ["a"], version: 6 });
  });

  it("a real 409 takes the server state and reports a conflict once", async () => {
    const h = harness();
    const a = h.edit(["a"]);
    const b = h.edit(["a", "b"]);
    await h.tick();
    h.calls[0]!.resolve({ ok: false, conflict: true, state: S(9, ["z"]) });
    expect(await a).toEqual({ ok: false, conflict: true });
    expect(await b).toEqual({ ok: false, cancelled: true });
    expect(h.state().arrangement).toMatchObject({ bench: ["z"], version: 9 });
  });

  it("after the queue drains, a reloaded state's version is used", async () => {
    const h = harness();
    const a = h.edit(["a"]);
    await h.tick();
    h.calls[0]!.resolve({ ok: true, version: 6 });
    await a;
    h.q.options.set(applyDraft(S(11), D(["a"])));
    void h.edit(["a", "q"]);
    await h.tick();
    expect(h.calls[1]!.version).toBe(11);
  });
});
