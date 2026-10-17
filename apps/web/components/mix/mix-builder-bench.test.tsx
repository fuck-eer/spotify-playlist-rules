import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { benchAria } from "@/components/graph/bench-cluster";
import { BenchPanel } from "@/components/graph/bench-panel";
import { removeKind, resetBenchSession } from "@/components/graph/mix-graph";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import type { MixRow } from "@/lib/db/mixes-repo";
import type { MixState } from "@/lib/mix-state";
import { MixBuilder } from "./mix-builder";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock, Toaster: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const T = (s: string) => `spotify:track:${s}`;
const MIX: MixRow = {
  id: "m1",
  name: "Gym",
  source: { type: "playlist", id: "pl", name: "Gym" },
  keepSourceOrder: true,
  shuffleSeed: 1,
  targetPlaylistId: null,
  lastSavedAt: null,
  ruleCount: 3,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const rule = (
  id: string,
  kind: MixRuleRow["kind"],
  n: number | null,
  s: string,
  position: number,
): MixRuleRow => ({
  id,
  ruleId: `lib-${id}`,
  kind,
  n,
  position,
  trackUri: T(s),
  songName: s.toUpperCase(),
  removedPlays: 0,
  deletedCopies: [],
});
const RULES = [
  rule("p", "pin_first", null, "b", 0),
  rule("e", "every_n", 2, "c", 1),
  rule("rp", "repeat", 3, "d", 2),
];
const ids = ["a", "b", "c", "d"];
const STATE = (over: Partial<MixState["arrangement"]> = {}, rules = RULES): MixState => ({
  mix: MIX,
  rules,
  source: ids.map((s) => ({ uri: T(s), name: s.toUpperCase(), artists: ["Kavi"] })),
  tracks: Object.fromEntries(
    ids.map((s) => [T(s), { name: s.toUpperCase(), artists: ["Kavi"], imageUrl: null }]),
  ),
  arrangement: { manualOrder: null, bench: [], version: 1, ...over },
});
let state = STATE();
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
const puts = () =>
  fetchMock.mock.calls
    .filter(([u, i]) => u === "/api/mixes/m1/arrangement" && i?.method === "PUT")
    .map(([, i]) => JSON.parse(i!.body as string) as Record<string, unknown>);

beforeEach(() => {
  state = STATE();
  resetBenchSession();
  toastMock.mockClear();
  fetchMock = vi.fn<Fetch>((url, init) => {
    if (url === "/api/mixes/m1/state") return Promise.resolve(Response.json(state));
    if (url === "/api/mixes/m1/arrangement") {
      const body = JSON.parse(init!.body as string) as { version: number };
      return Promise.resolve(Response.json({ version: body.version + 1 }));
    }
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cover = (key: string) =>
  document.querySelector<HTMLButtonElement>(`[data-key="${key}"] button`)!;
async function ready() {
  render(<MixBuilder mix={MIX} rules={RULES} maxRules={10} />);
  await waitFor(() => expect(cover(`b:${T("a")}`)).toBeTruthy());
}

describe("bench and delete", () => {
  it("target kind: Bench for Originals, Delete for copies and Repeat stacks", () => {
    const base = {
      uri: "u",
      ruleIndex: null,
      ruleIndices: [],
      shiftedFrom: null,
      copyIndex: null,
      firstSlot: 0,
    };
    expect(removeKind({ ...base, key: "b:u", role: "original", plays: 1 })).toBe("bench");
    expect(removeKind({ ...base, key: "b:u", role: "original", plays: 3 })).toBe("delete");
    expect(removeKind({ ...base, key: "r:x:1", role: "copy", plays: 1 })).toBe("delete");
  });

  it("Delete on an Original benches it; first toast is the hint, then the usual copy", async () => {
    await ready();
    fireEvent.keyDown(cover(`b:${T("a")}`), { key: "Delete" });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toMatchObject({ bench: [T("a")] });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "Benched. Tap the bench to bring it back.",
        expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) as unknown }),
      ),
    );
    const cluster = await screen.findByRole("button", { name: "Bench, 1 song. Tap to open." });
    expect(cluster.textContent).toContain("Bench · 1");
    await waitFor(() => expect(cover(`b:${T("b")}`)).toBeTruthy());
    fireEvent.keyDown(cover(`b:${T("b")}`), { key: "Backspace" });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "Benched. It won't play in this mix.",
        expect.anything(),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Bench, 2 songs. Tap to open." }),
    ).toBeTruthy();
  });

  it("a Start with copy can't be deleted", async () => {
    await ready();
    fireEvent.keyDown(cover("r:p:0"), { key: "Delete" });
    expect(toastMock).toHaveBeenCalledWith("Start with plays once. Remove the rule instead.");
    expect(puts()).toHaveLength(0);
  });

  it("deletes an After every N copy and one Repeat play with rule numbers", async () => {
    await ready();
    fireEvent.keyDown(cover("r:e:1"), { key: "Delete" });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "Copy deleted. Rule #2 still applies.",
        expect.anything(),
      ),
    );
    expect(
      (puts()[0]!.rules as { id: string; deletedCopies: number[] }[]).find((r) => r.id === "e")!
        .deletedCopies,
    ).toEqual([1]);
    fireEvent.keyDown(cover(`b:${T("d")}`), { key: "Delete" });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        "One play deleted. Rule #3 still applies.",
        expect.anything(),
      ),
    );
    expect(
      (puts()[1]!.rules as { id: string; removedPlays: number }[]).find((r) => r.id === "rp")!
        .removedPlays,
    ).toBe(1);
  });

  it("popover shows Move to bench / Delete this copy, none for Start with", async () => {
    await ready();
    fireEvent.click(cover(`b:${T("a")}`));
    expect(await screen.findByRole("button", { name: "Move to bench" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(cover("r:e:1"));
    expect(await screen.findByRole("button", { name: "Delete this copy" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(cover("r:p:0"));
    await screen.findByTestId("song-popover");
    expect(screen.queryByRole("button", { name: /Move to bench|Delete this copy/ })).toBeNull();
  });

  it("cluster opens the panel; Enter on a row brings it back at the end", async () => {
    state = STATE({ bench: [T("c")] });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: benchAria(1) }));
    expect(screen.getByText("On the bench")).toBeTruthy();
    expect(screen.getByText("Drag a song onto the line to bring it back.")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "C, Kavi" }), { key: "Enter" });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toMatchObject({ bench: [], manualOrder: [T("a"), T("b"), T("d"), T("c")] });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.stringMatching(/^Back in at slot \d+$/),
        expect.anything(),
      ),
    );
    expect(screen.queryByTestId("bench-cluster")).toBeNull();
  });

  it("row menu: Put back at slot validates 1..total+1", async () => {
    state = STATE({ bench: [T("c")] });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: benchAria(1) }));
    fireEvent.click(screen.getByRole("button", { name: "C, Kavi" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Put back at slot…" }));
    const input = screen.getAllByLabelText("Slot number").at(-1)!;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert").textContent).toMatch(/^Pick a slot from 1 to \d+\.$/);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect((puts()[0]!.manualOrder as string[])[0]).toBe(T("c"));
  });

  it("panel empty state and cluster labels", () => {
    expect(benchAria(1)).toBe("Bench, 1 song. Tap to open.");
    expect(benchAria(3)).toBe("Bench, 3 songs. Tap to open.");
    render(
      <BenchPanel
        rows={[]}
        total={3}
        onClose={() => {}}
        onRestoreEnd={() => {}}
        onRestoreSlot={() => {}}
        onRowPointerDown={() => {}}
      />,
    );
    expect(screen.getByText("Nothing on the bench.")).toBeTruthy();
  });
});
