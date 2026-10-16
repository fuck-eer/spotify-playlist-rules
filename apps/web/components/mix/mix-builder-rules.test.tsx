import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import type { MixRow } from "@/lib/db/mixes-repo";
import { MixBuilder } from "./mix-builder";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const MIX: MixRow = {
  id: "m1",
  name: "Gym",
  source: { type: "playlist", id: "pl-own", name: "Gym bangers" },
  keepSourceOrder: false,
  shuffleSeed: 1,
  targetPlaylistId: null,
  lastSavedAt: null,
  ruleCount: 0,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const mr = (id: string, position: number, songName: string): MixRuleRow => ({
  id,
  ruleId: "r1",
  kind: "repeat",
  n: 3,
  position,
  trackUri: `spotify:track:${songName.toLowerCase()}`,
  songName,
  removedPlays: 0,
  deletedCopies: [],
});
const LIBRARY = {
  rules: [
    {
      id: "r1",
      kind: "repeat",
      n: 3,
      pinned: false,
      archivedAt: null,
      usedInMixes: 0,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "r2",
      kind: "pin_first",
      n: null,
      pinned: false,
      archivedAt: "2026-10-01T00:00:00.000Z",
      usedInMixes: 0,
      createdAt: "",
      updatedAt: "",
    },
  ],
};
const SONGS = {
  songs: [
    { uri: "spotify:track:echo", name: "Echo", artists: ["Kavi"] },
    { uri: "spotify:track:drift", name: "Drift", artists: ["Oren"] },
  ],
};
const SOURCES = {
  maxSourceTracks: 600,
  sources: [
    {
      type: "liked",
      id: null,
      name: "Liked Songs",
      trackCount: 3,
      imageUrl: null,
      ownerName: "N",
      tooLarge: false,
    },
    {
      type: "playlist",
      id: "pl-own",
      name: "Gym bangers",
      trackCount: 4,
      imageUrl: null,
      ownerName: "N",
      tooLarge: false,
    },
  ],
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
const calls = (method: string, url: string) =>
  fetchMock.mock.calls.filter(([u, i]) => u === url && (i?.method ?? "GET") === method);

beforeEach(() => {
  fetchMock = vi.fn<Fetch>((url, init) => {
    const method = init?.method ?? "GET";
    if (url === "/api/rules") return Promise.resolve(Response.json(LIBRARY));
    if (url === "/api/sources") return Promise.resolve(Response.json(SOURCES));
    if (url === "/api/mixes/m1/songs") return Promise.resolve(Response.json(SONGS));
    if (url === "/api/mixes/m1/rules" && method === "POST")
      return Promise.resolve(Response.json({ rule: mr("new", 0, "Drift") }, { status: 201 }));
    if (url === "/api/mixes/m1/rules/order")
      return Promise.resolve(new Response(null, { status: 204 }));
    if (url === "/api/mixes/m1" && method === "PATCH")
      return Promise.resolve(Response.json({ mix: { ...MIX, source: SOURCES.sources[0] } }));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MixBuilder rules", () => {
  it("shows the empty state and hint", () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    expect(screen.getByText("No rules yet. Without one, you just get a copy.")).toBeTruthy();
    expect(screen.getByText("Drag to reorder. The top rule wins a conflict.")).toBeTruthy();
  });

  it("adds a rule: rule picker → song picker → card", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add rule" }));
    const newRule = await screen.findByRole("link", { name: "New rule" });
    expect(newRule.getAttribute("href")).toBe("/rules/new?mix=m1");
    expect(screen.queryByText("Play a song first")).toBeNull(); // archived rule hidden
    fireEvent.click(await screen.findByRole("button", { name: /Play a song 3 times in a row/ }));
    expect(await screen.findByText("Pick the rule's song")).toBeTruthy();
    fireEvent.change(await screen.findByPlaceholderText("Search songs"), {
      target: { value: "oren" },
    });
    expect(screen.queryByRole("button", { name: /Echo/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Drift · Oren/ }));
    expect(await screen.findByText("Repeat · Drift · 3×")).toBeTruthy();
    expect(JSON.parse(calls("POST", "/api/mixes/m1/rules")[0]![1]!.body as string)).toEqual({
      ruleId: "r1",
      trackUri: "spotify:track:drift",
    });
  });

  it("hides + Add rule at the limit and shows the limit line", () => {
    render(<MixBuilder mix={MIX} rules={[mr("a", 0, "Echo"), mr("b", 1, "Drift")]} maxRules={2} />);
    expect(screen.queryByRole("button", { name: "+ Add rule" })).toBeNull();
    expect(screen.getByText("Up to 2 rules per mix.")).toBeTruthy();
  });

  it("keyboard reorder PUTs the new order and renumbers", async () => {
    render(
      <MixBuilder mix={MIX} rules={[mr("a", 0, "Echo"), mr("b", 1, "Drift")]} maxRules={10} />,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder #02" }), { key: "ArrowUp" });
    await waitFor(() => expect(calls("PUT", "/api/mixes/m1/rules/order")).toHaveLength(1));
    expect(JSON.parse(calls("PUT", "/api/mixes/m1/rules/order")[0]![1]!.body as string)).toEqual({
      ids: ["b", "a"],
    });
    const cards = screen.getAllByTestId("rule-card");
    expect(within(cards[0]!).getByText("#01")).toBeTruthy();
    expect(within(cards[0]!).getByText("Repeat · Drift · 3×")).toBeTruthy();
  });

  it("asks before changing the source of a mix with rules", async () => {
    render(
      <MixBuilder mix={{ ...MIX, ruleCount: 1 }} rules={[mr("a", 0, "Echo")]} maxRules={10} />,
    );
    const pick = async () => {
      fireEvent.click(screen.getByRole("button", { name: /Change source/ }));
      fireEvent.click(await screen.findByRole("button", { name: /Liked Songs/ }));
    };
    await pick();
    expect(await screen.findByText("Change source?")).toBeTruthy();
    expect(screen.getByText("This clears the rules in this mix.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(calls("PATCH", "/api/mixes/m1")).toHaveLength(0);
    expect(screen.getByText("Repeat · Echo · 3×")).toBeTruthy();

    await pick();
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    await waitFor(() => expect(calls("PATCH", "/api/mixes/m1")).toHaveLength(1));
    expect(await screen.findByText("No rules yet. Without one, you just get a copy.")).toBeTruthy();
  });

  it("opens the song picker for ?addRule", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} addRuleId="r1" />);
    expect(await screen.findByText("Pick the rule's song")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/mixes/m1");
  });
});
