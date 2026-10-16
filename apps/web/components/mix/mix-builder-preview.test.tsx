import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import type { MixRow } from "@/lib/db/mixes-repo";
import type { PreviewResponse } from "@/lib/preview";
import { MixBuilder } from "./mix-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const MIX: MixRow = {
  id: "m1",
  name: "Gym",
  source: { type: "playlist", id: "pl-own", name: "Gym bangers" },
  keepSourceOrder: false,
  shuffleSeed: 1,
  targetPlaylistId: null,
  lastSavedAt: null,
  ruleCount: 2,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const T = (s: string) => `spotify:track:${s}`;
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
  {
    id: "b",
    ruleId: "r2",
    kind: "repeat",
    n: 2,
    position: 1,
    trackUri: T("gone"),
    songName: "Gone",
    removedPlays: 0,
    deletedCopies: [],
  },
];
const PREVIEW: PreviewResponse = {
  slots: [
    { uri: T("b"), ruleIndex: 0, ruleIndices: [0], shiftedFrom: null },
    { uri: T("a"), ruleIndex: null, ruleIndices: [], shiftedFrom: 0 },
    { uri: T("c"), ruleIndex: null, ruleIndices: [], shiftedFrom: null },
  ],
  names: { [T("a")]: "A", [T("b")]: "B", [T("c")]: "C" },
  kinds: ["pin_first", "repeat"],
  stats: { total: 3, rulesApplied: 1, skippedUnavailable: 2, benched: 0 },
  issues: [{ kind: "rule_song_not_in_source", ruleIndex: 1 }],
  summary: "3 tracks · 1 rule applied",
  skippedText: "2 songs skipped (unavailable)",
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
const calls = (method: string, url: string) =>
  fetchMock.mock.calls.filter(([u, i]) => u === url && (i?.method ?? "GET") === method);

beforeEach(() => {
  fetchMock = vi.fn<Fetch>((url, init) => {
    const method = init?.method ?? "GET";
    if (url === "/api/mixes/m1/preview") return Promise.resolve(Response.json(PREVIEW));
    if (url === "/api/mixes/m1/reshuffle") return Promise.resolve(Response.json({ seed: 9 }));
    if (url === "/api/mixes/m1" && method === "PATCH")
      return Promise.resolve(Response.json({ mix: { ...MIX, keepSourceOrder: true } }));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MixBuilder preview", () => {
  it("renders the dots, summary, skipped text and the moved-from badge", async () => {
    render(<MixBuilder mix={MIX} rules={RULES} maxRules={10} />);
    expect(await screen.findByText("3 tracks · 1 rule applied")).toBeTruthy();
    expect(screen.getByText("2 songs skipped (unavailable)")).toBeTruthy();
    expect(screen.getByText("moved from #1")).toBeTruthy();
    expect(screen.getByText("PREVIEW")).toBeTruthy();
  });

  it("flags the rule card whose song is unavailable", async () => {
    render(<MixBuilder mix={MIX} rules={RULES} maxRules={10} />);
    const warning = await screen.findByText("Song unavailable. Pick another.");
    const cards = screen.getAllByTestId("rule-card");
    expect(cards[1]!.contains(warning)).toBe(true);
    expect(cards[0]!.textContent).not.toContain("Song unavailable");
  });

  it("Keep base order: off shows Reshuffle; turning it on PATCHes and hides Reshuffle", async () => {
    render(<MixBuilder mix={MIX} rules={RULES} maxRules={10} />);
    expect(screen.getByText("Off reshuffles the base list once before rules run.")).toBeTruthy();
    expect(screen.queryByText("Remove rule songs from base")).toBeNull();
    const toggle = screen.getByRole("switch", { name: "Keep base order" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: "Reshuffle" })).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: "Reshuffle" })).toBeNull();
    await waitFor(() => expect(calls("PATCH", "/api/mixes/m1")).toHaveLength(1));
    expect(JSON.parse(calls("PATCH", "/api/mixes/m1")[0]![1]!.body as string)).toEqual({
      keepSourceOrder: true,
    });
  });

  it("Reshuffle and Regenerate refetch the preview", async () => {
    render(<MixBuilder mix={MIX} rules={RULES} maxRules={10} />);
    await screen.findByText("3 tracks · 1 rule applied");
    expect(calls("GET", "/api/mixes/m1/preview")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(calls("GET", "/api/mixes/m1/preview")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Reshuffle" }));
    await waitFor(() => expect(calls("POST", "/api/mixes/m1/reshuffle")).toHaveLength(1));
    await waitFor(() => expect(calls("GET", "/api/mixes/m1/preview")).toHaveLength(3));
  });
});
