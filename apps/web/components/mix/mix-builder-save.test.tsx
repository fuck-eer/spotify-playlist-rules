import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MixRow } from "@/lib/db/mixes-repo";
import type { SaveRunRow } from "@/lib/db/save-runs-repo";
import { MixBuilder } from "./mix-builder";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const MIX: MixRow = {
  id: "m1",
  name: "Gym",
  source: { type: "liked", id: null, name: "Liked Songs" },
  keepSourceOrder: false,
  shuffleSeed: 1,
  targetPlaylistId: null,
  lastSavedAt: null,
  ruleCount: 0,
  createdAt: "2026-10-16T09:00:00.000Z",
  updatedAt: "2026-10-16T09:00:00.000Z",
};
const run = (p: Partial<SaveRunRow>): SaveRunRow => ({
  id: "run1",
  mixId: "m1",
  kind: "save",
  playback: null,
  playlistId: null,
  status: "running",
  phase: "reading",
  done: 0,
  total: 0,
  tracksWritten: 0,
  recreated: false,
  retries429: 0,
  error: null,
  startedAt: "2026-10-16T09:00:00.000Z",
  finishedAt: null,
  ...p,
});

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
let runs: SaveRunRow[];
const polls = () => fetchMock.mock.calls.filter(([u]) => u === "/api/mixes/m1/save/run1").length;
const posts = () =>
  fetchMock.mock.calls.filter(([u, i]) => u === "/api/mixes/m1/save" && i?.method === "POST")
    .length;

beforeEach(() => {
  vi.useFakeTimers();
  toast.success.mockReset();
  toast.error.mockReset();
  refresh.mockReset();
  runs = [];
  fetchMock = vi.fn<Fetch>((url, init) => {
    if (url === "/api/mixes/m1/save" && init?.method === "POST")
      return Promise.resolve(Response.json({ runId: "run1" }, { status: 202 }));
    if (url === "/api/mixes/m1/save/run1")
      return Promise.resolve(Response.json({ run: runs.length > 1 ? runs.shift()! : runs[0]! }));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function clickSave() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save to Spotify" }));
    await vi.advanceTimersByTimeAsync(0);
  });
}
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("MixBuilder Save to Spotify", () => {
  it("shows the shuffle tip under the button", () => {
    render(<MixBuilder mix={MIX} />);
    expect(
      screen.getByText("Play with shuffle off. Saving while it's playing may skip ahead."),
    ).toBeTruthy();
  });

  it("polls every 1000 ms with progress, stops on success and toasts", async () => {
    runs = [
      run({ phase: "reading", done: 1, total: 3 }),
      run({ phase: "writing", done: 3, total: 3 }),
      run({ status: "succeeded", phase: "done", done: 3, total: 3, tracksWritten: 3 }),
    ];
    render(<MixBuilder mix={MIX} />);
    await clickSave();
    expect(posts()).toBe(1);
    expect(polls()).toBe(0);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save to Spotify" }).disabled,
    ).toBe(true);
    await tick(1000);
    expect(polls()).toBe(1);
    expect(screen.getByText("Reading 1/3")).toBeTruthy();
    await tick(1000);
    expect(screen.getByText("Writing 3/3")).toBeTruthy();
    await tick(1000);
    expect(polls()).toBe(3);
    expect(toast.success).toHaveBeenCalledWith(
      'Saved "Rules: Gym" to Spotify. Play it with shuffle off.',
    );
    expect(refresh).toHaveBeenCalled();
    await tick(5000);
    expect(polls()).toBe(3);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save to Spotify" }).disabled,
    ).toBe(false);
  });

  it("adds the recreated note", async () => {
    runs = [run({ status: "succeeded", phase: "done", recreated: true })];
    render(<MixBuilder mix={MIX} />);
    await clickSave();
    await tick(1000);
    expect(toast.success).toHaveBeenCalledWith(
      'Saved "Rules: Gym" to Spotify. Play it with shuffle off. It was recreated because the old one was gone.',
    );
  });

  it("shows the failure toast with a Retry action that saves again", async () => {
    runs = [
      run({
        status: "failed",
        error: "Couldn't create the playlist. Check your connection and retry.",
      }),
    ];
    render(<MixBuilder mix={MIX} />);
    await clickSave();
    await tick(1000);
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [message, opts] = toast.error.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Couldn't create the playlist. Check your connection and retry.");
    expect(opts.action.label).toBe("Retry");
    await act(async () => {
      opts.action.onClick();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(posts()).toBe(2);
  });
});

describe("MixBuilder saved dialog and Open in Spotify", () => {
  it("after a successful save shows a dialog linking to the target playlist", async () => {
    runs = [run({ status: "succeeded", phase: "writing", done: 3, total: 3 })];
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) =>
      url === "/api/mixes/m1" && !init?.method
        ? Promise.resolve(Response.json({ mix: { ...MIX, targetPlaylistId: "tgt9" } }))
        : base(url, init),
    );
    render(<MixBuilder mix={MIX} />);
    expect(screen.queryByRole("link", { name: "Open in Spotify" })).toBeNull();
    await clickSave();
    await tick(1000);
    await tick(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("open.spotify.com/playlist/tgt9");
    const links = screen.getAllByRole("link", { name: /Open in Spotify|open\.spotify\.com/ });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const a of links) {
      expect(a.getAttribute("href")).toBe("https://open.spotify.com/playlist/tgt9");
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
  });

  it("shows a persistent Open in Spotify link when the mix has a target", () => {
    render(<MixBuilder mix={{ ...MIX, targetPlaylistId: "tgt1" }} />);
    const a = screen.getByRole("link", { name: "Open in Spotify" });
    expect(a.getAttribute("href")).toBe("https://open.spotify.com/playlist/tgt1");
    expect(a.getAttribute("target")).toBe("_blank");
  });
});
