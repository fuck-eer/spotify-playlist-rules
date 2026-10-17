import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  ruleCount: 1,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const RULES: MixRuleRow[] = [
  {
    id: "a",
    ruleId: "r1",
    kind: "pin_first",
    n: null,
    position: 0,
    trackUri: T("b"),
    songName: "B",
    removedPlays: 0,
    deletedCopies: [],
  },
];
const item = (id: string) => ({ uri: T(id), name: id.toUpperCase(), artists: ["Kavi"] });
const STATE = (over: Partial<MixState["arrangement"]> = {}): MixState => ({
  mix: MIX,
  rules: RULES,
  source: [item("a"), item("b"), item("c")],
  tracks: Object.fromEntries(
    ["a", "b", "c"].map((s) => [
      T(s),
      { name: s.toUpperCase(), artists: ["Kavi"], imageUrl: null },
    ]),
  ),
  arrangement: { manualOrder: null, bench: [], version: 3, ...over },
});
let state = STATE();
let putStatus = 200;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
const puts = () =>
  fetchMock.mock.calls.filter(([u, i]) => u === "/api/mixes/m1/arrangement" && i?.method === "PUT");

beforeEach(() => {
  state = STATE();
  putStatus = 200;
  toastMock.mockClear();
  fetchMock = vi.fn<Fetch>((url, init) => {
    if (url === "/api/mixes/m1/state") return Promise.resolve(Response.json(state));
    if (url === "/api/mixes/m1/arrangement") {
      if (putStatus === 409)
        return Promise.resolve(
          Response.json(
            {
              error: { code: "conflict" },
              state: STATE({ manualOrder: [T("c"), T("a"), T("b")], version: 7 }),
            },
            { status: 409 },
          ),
        );
      const body = JSON.parse(init?.body as string) as { version: number };
      return Promise.resolve(Response.json({ version: body.version + 1 }));
    }
    if (url === "/api/mixes/m1/reset-order") return Promise.resolve(Response.json({ ok: true }));
    if (url === "/api/mixes/m1/reshuffle") return Promise.resolve(Response.json({ seed: 9 }));
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
  await screen.findByText(/4 songs · 1 rules?/);
}
async function keyboardMoveAAfterB() {
  const a = cover(`b:${T("a")}`);
  fireEvent.keyDown(a, { key: " " });
  fireEvent.keyDown(a, { key: "ArrowRight" });
  expect(screen.getByText(/Move to slot 3/)).toBeTruthy();
  fireEvent.keyDown(a, { key: " " });
  await waitFor(() => expect(puts()).toHaveLength(1));
}

describe("MixBuilder drag & reorder", () => {
  it("keyboard pick-up/move/drop PUTs the new order with the version and toasts with Undo", async () => {
    await ready();
    await keyboardMoveAAfterB();
    const body = JSON.parse(puts()[0]![1]!.body as string) as {
      version: number;
      manualOrder: string[];
    };
    expect(body.version).toBe(3);
    expect(body.manualOrder).toEqual([T("b"), T("a"), T("c")]);
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith("Moved to slot 3. Order saved.", expect.anything()),
    );
    expect(screen.getByText(/your order/)).toBeTruthy();
    // Screen readers hear the move from a dedicated polite live region.
    const live = screen.getByTestId("graph-announcer");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toContain("Moved to slot 3. Order saved.");
    const opts = toastMock.mock.calls.find((c) => c[0] === "Moved to slot 3. Order saved.")![1] as {
      action: { label: string; onClick: () => void };
    };
    expect(opts.action.label).toBe("Undo");
    opts.action.onClick();
    await waitFor(() => expect(puts()).toHaveLength(2));
    const undo = JSON.parse(puts()[1]![1]!.body as string) as {
      version: number;
      manualOrder: unknown;
    };
    expect(undo).toMatchObject({ version: 4, manualOrder: null });
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith("Move undone", expect.anything()));
    expect(screen.getByTestId("graph-announcer").textContent).toContain("Move undone");
  });

  it("Esc cancels a keyboard pick-up", async () => {
    await ready();
    const a = cover(`b:${T("a")}`);
    fireEvent.keyDown(a, { key: " " });
    fireEvent.keyDown(a, { key: "Escape" });
    expect(screen.queryByText(/Drop to play it here/)).toBeNull();
    expect(puts()).toHaveLength(0);
  });

  it("refuses to move a rule copy", async () => {
    await ready();
    fireEvent.keyDown(cover(`r:a:0`), { key: " " });
    expect(toastMock).toHaveBeenCalledWith("Rule songs stay where their rule puts them.");
    expect(puts()).toHaveLength(0);
  });

  it("409 replaces with the server state and says so", async () => {
    putStatus = 409;
    await ready();
    await keyboardMoveAAfterB();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith("Updated from another device."));
    expect(screen.getByText(/your order/)).toBeTruthy();
  });

  it("Go to slot validates the range", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Go to slot" }));
    const input = screen.getByLabelText("Slot number");
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByRole("alert").textContent).toBe("Pick a slot from 1 to 4.");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.queryByLabelText("Slot number")).toBeNull();
    expect(document.activeElement).toBe(cover(`b:${T("b")}`));
  });

  it("Reset to rule order confirms and clears", async () => {
    state = STATE({ manualOrder: [T("c"), T("a"), T("b")] });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Reset to rule order" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) => u === "/api/mixes/m1/reset-order" && i?.method === "POST",
        ),
      ).toBe(true),
    );
  });
});
