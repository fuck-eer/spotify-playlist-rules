import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MixRuleRow } from "@/lib/db/mix-rules-repo";
import type { MixRow } from "@/lib/db/mixes-repo";
import type { MixState } from "@/lib/mix-state";
import { MixBuilder } from "./mix-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const T = (s: string) => `spotify:track:${s}`;
const MIX: MixRow = {
  id: "m1",
  name: "Gym",
  source: { type: "playlist", id: "pl-own", name: "Gym bangers" },
  keepSourceOrder: true,
  shuffleSeed: 1,
  targetPlaylistId: null,
  lastSavedAt: null,
  ruleCount: 0,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const mr = (
  id: string,
  kind: MixRuleRow["kind"],
  n: number | null,
  song: string,
  position = 0,
): MixRuleRow => ({
  id,
  ruleId: `lib-${id}`,
  kind,
  n,
  position,
  trackUri: T(song),
  songName: song,
  removedPlays: 0,
  deletedCopies: [],
});
let rulesOnServer: MixRuleRow[] = [];
const state = (): MixState => ({
  mix: MIX,
  rules: rulesOnServer,
  source: ["a", "b", "c", "d"].map((x) => ({
    uri: T(x),
    name: x.toUpperCase(),
    artists: ["Kavi"],
  })),
  tracks: Object.fromEntries(
    ["a", "b", "c", "d"].map((x) => [
      T(x),
      { name: x.toUpperCase(), artists: ["Kavi"], imageUrl: null },
    ]),
  ),
  arrangement: { manualOrder: null, bench: [], version: 0 },
});

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
const calls = (method: string, url: string) =>
  fetchMock.mock.calls.filter(([u, i]) => u === url && (i?.method ?? "GET") === method);

beforeEach(() => {
  rulesOnServer = [];
  fetchMock = vi.fn<Fetch>((url, init) => {
    const method = init?.method ?? "GET";
    if (url === "/api/mixes/m1/state") return Promise.resolve(Response.json(state()));
    if (url === "/api/rules" && method === "GET")
      return Promise.resolve(
        Response.json({ rules: [{ id: "lib-pin", kind: "pin_first", n: null, archivedAt: null }] }),
      );
    if (url === "/api/rules" && method === "POST") {
      const b = JSON.parse(init!.body as string) as { kind: string; n: number };
      return Promise.resolve(
        Response.json({ rule: { id: `lib-${b.kind}-${b.n}`, ...b } }, { status: 201 }),
      );
    }
    if (url === "/api/mixes/m1/rules" && method === "POST") {
      const b = JSON.parse(init!.body as string) as { ruleId: string; trackUri: string };
      const kind =
        b.ruleId === "lib-pin" ? "pin_first" : b.ruleId.includes("every_n") ? "every_n" : "repeat";
      const n = kind === "pin_first" ? null : Number(b.ruleId.split("-").pop());
      const row = mr(
        `m${rulesOnServer.length}`,
        kind,
        n,
        b.trackUri.split(":").pop()!,
        rulesOnServer.length,
      );
      rulesOnServer = [...rulesOnServer, row];
      return Promise.resolve(Response.json({ rule: row }, { status: 201 }));
    }
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openCover(label: string) {
  const btn = await screen.findByRole("button", { name: label });
  fireEvent.click(btn);
  return { btn, card: await screen.findByTestId("song-popover") };
}

describe("song popover", () => {
  it("Start with uses the library rule and a new copy appears at slot 1", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    await openCover("Slot 3, C by Kavi");
    fireEvent.click(screen.getByRole("button", { name: "Start with" }));
    await waitFor(() => expect(calls("POST", "/api/mixes/m1/rules")).toHaveLength(1));
    expect(JSON.parse(calls("POST", "/api/mixes/m1/rules")[0]![1]!.body as string)).toEqual({
      ruleId: "lib-pin",
      trackUri: T("c"),
    });
    expect(calls("POST", "/api/rules")).toHaveLength(0);
    expect(
      await screen.findByRole("button", { name: "Slot 1, C by Kavi, rule #1 Start with" }),
    ).toBeTruthy();
  });

  it("After every N: stepper defaults to 4, bounded 2-10, creates the library rule if missing", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    await openCover("Slot 1, A by Kavi");
    fireEvent.click(screen.getByRole("button", { name: "After every N" }));
    expect(screen.getByText("Every how many songs?")).toBeTruthy();
    expect(screen.getByTestId("stepper-value").textContent).toBe("4");
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(screen.getByTestId("stepper-value").textContent).toBe("10");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Increase" }).disabled).toBe(true);
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(screen.getByTestId("stepper-value").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls("POST", "/api/mixes/m1/rules")).toHaveLength(1));
    expect(JSON.parse(calls("POST", "/api/rules")[0]![1]!.body as string)).toEqual({
      kind: "every_n",
      n: 2,
    });
    // B=4, n=2: copies of A at slots 3 and 6.
    expect(
      await screen.findAllByRole("button", { name: /A by Kavi, rule #1 After every 2/ }),
    ).toHaveLength(2);
  });

  it("Repeat stepper defaults to 2", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    await openCover("Slot 2, B by Kavi");
    fireEvent.click(screen.getByRole("button", { name: "Repeat" }));
    expect(screen.getByText("How many times?")).toBeTruthy();
    expect(screen.getByTestId("stepper-value").textContent).toBe("2");
  });

  it("at the rule cap the buttons are disabled with the cap copy", async () => {
    rulesOnServer = [mr("x", "pin_first", null, "a"), mr("y", "pin_first", null, "b", 1)];
    render(<MixBuilder mix={MIX} rules={rulesOnServer} maxRules={2} />);
    await openCover("Slot 3, A by Kavi");
    const card = screen.getByTestId("song-popover");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Start with" }).disabled).toBe(
      true,
    );
    expect(card.textContent).toContain("Up to 2 rules per mix.");
    expect(card.textContent).toContain("Remove");
  });

  it("Esc closes and returns focus to the cover; the skipped link opens its card", async () => {
    render(<MixBuilder mix={MIX} rules={[]} maxRules={10} />);
    const { btn } = await openCover("Slot 4, D by Kavi");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("song-popover")).toBeNull());
    expect(document.activeElement).toBe(btn);
  });

  it("Change edits the rule in place (PATCH), keeping its priority position", async () => {
    rulesOnServer = [mr("x", "every_n", 4, "a", 0), mr("y", "repeat", 2, "c", 1)];
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) => {
      if (url === "/api/mixes/m1/rules/x" && init?.method === "PATCH") {
        const b = JSON.parse(init.body as string) as { ruleId: string };
        const row = { ...mr("x", "every_n", 5, "a", 0), ruleId: b.ruleId };
        rulesOnServer = [row, rulesOnServer[1]!];
        return Promise.resolve(Response.json({ rule: row }));
      }
      return base(url, init);
    });
    render(<MixBuilder mix={MIX} rules={rulesOnServer} maxRules={10} />);
    const btn = (await screen.findAllByRole("button", { name: /^Slot \d+, A by Kavi$/ }))[0]!;
    fireEvent.click(btn);
    await screen.findByTestId("song-popover");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls("PATCH", "/api/mixes/m1/rules/x")).toHaveLength(1));
    expect(JSON.parse(calls("PATCH", "/api/mixes/m1/rules/x")[0]![1]!.body as string)).toEqual({
      ruleId: "lib-every_n-5",
    });
    expect(calls("DELETE", "/api/mixes/m1/rules/x")).toHaveLength(0);
    expect(calls("POST", "/api/mixes/m1/rules")).toHaveLength(0);
    await waitFor(() =>
      expect(screen.getAllByTestId("rule-card").map((c) => c.textContent)).toEqual([
        expect.stringContaining("5") as unknown,
        expect.stringContaining("Repeat") as unknown,
      ]),
    );
  });
});
