import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MixRow } from "@/lib/db/mixes-repo";
import type { SaveRunRow } from "@/lib/db/save-runs-repo";
import { MixBuilder } from "./mix-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

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
  kind: "play",
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
const done = (p: Partial<SaveRunRow>) =>
  run({ status: "succeeded", phase: "done", playlistId: "pl9", ...p });

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn<Fetch>>;
let runs: SaveRunRow[];
const plays = () =>
  fetchMock.mock.calls.filter(([u, i]) => u === "/api/mixes/m1/play" && i?.method === "POST")
    .length;

beforeEach(() => {
  vi.useFakeTimers();
  toast.success.mockReset();
  toast.error.mockReset();
  openExternal.mockReset();
  runs = [];
  fetchMock = vi.fn<Fetch>((url, init) => {
    if (url === "/api/mixes/m1/play" && init?.method === "POST")
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

async function clickPlay() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await vi.advanceTimersByTimeAsync(0);
  });
}
const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const button = (name: string) => screen.getByRole<HTMLButtonElement>("button", { name });

describe("MixBuilder Play", () => {
  it("posts Play, shows progress, disables both actions, then opens the Player playlist", async () => {
    runs = [run({ phase: "writing", done: 2, total: 3 }), done({ playback: "started" })];
    render(<MixBuilder mix={MIX} />);
    await clickPlay();
    expect(plays()).toBe(1);
    expect(button("Play").disabled).toBe(true);
    expect(button("Save to Spotify").disabled).toBe(true);
    await tick(1000);
    expect(screen.getByText("Writing 2/3")).toBeTruthy();
    expect(openExternal).not.toHaveBeenCalled();
    await tick(1000);
    expect(toast.success).toHaveBeenCalledWith("Playing on Spotify.");
    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith("https://open.spotify.com/playlist/pl9");
    expect(button("Play").disabled).toBe(false);
  });

  it.each(["not_started", "no_device", "needs_scopes"] as const)(
    "%s: says the player is ready and still opens it",
    async (playback) => {
      runs = [done({ playback })];
      render(<MixBuilder mix={MIX} />);
      await clickPlay();
      await tick(1000);
      expect(toast.success).toHaveBeenCalledWith("rulemix player is ready. Opening Spotify…");
      expect(toast.error).not.toHaveBeenCalled();
      expect(openExternal).toHaveBeenCalledWith("https://open.spotify.com/playlist/pl9");
    },
  );

  it("a failed Play shows the error with a Retry that plays again, and opens nothing", async () => {
    runs = [run({ status: "failed", error: "Spotify access expired. Sign in again." })];
    render(<MixBuilder mix={MIX} />);
    await clickPlay();
    await tick(1000);
    const [message, opts] = toast.error.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Spotify access expired. Sign in again.");
    expect(openExternal).not.toHaveBeenCalled();
    await act(async () => {
      opts.action.onClick();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(plays()).toBe(2);
  });

  it("shows the re-login hint only without playback scopes", () => {
    render(<MixBuilder mix={MIX} canAutoPlay={false} />);
    const a = screen.getByRole("link", { name: "Log in again to enable auto-play" });
    expect(a.getAttribute("href")).toBe("/api/auth/login");
    cleanup();
    render(<MixBuilder mix={MIX} />);
    expect(screen.queryByText("Log in again to enable auto-play")).toBeNull();
  });
});
