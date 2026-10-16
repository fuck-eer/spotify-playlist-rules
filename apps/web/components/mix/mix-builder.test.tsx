import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MixBuilder } from "./mix-builder";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const SOURCES = {
  maxSourceTracks: 600,
  sources: [
    {
      type: "liked",
      id: null,
      name: "Liked Songs",
      trackCount: 412,
      imageUrl: null,
      ownerName: "N",
      tooLarge: false,
    },
    {
      type: "playlist",
      id: "big",
      name: "Everything",
      trackCount: 1200,
      imageUrl: null,
      ownerName: "N",
      tooLarge: true,
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
beforeEach(() => {
  replace.mockReset();
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/sources") return Promise.resolve(Response.json(SOURCES));
    if (url === "/api/mixes" && init?.method === "POST")
      return Promise.resolve(Response.json({ mix: { id: "m1" } }, { status: 201 }));
    return Promise.resolve(Response.json({}, { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MixBuilder", () => {
  it("shows the name placeholder and source hints", () => {
    render(<MixBuilder mix={null} />);
    expect(screen.getByPlaceholderText("Name this mix")).toBeTruthy();
    expect(screen.getByText("SOURCE")).toBeTruthy();
    expect(screen.getByText("Your playlists, collabs or Liked Songs.")).toBeTruthy();
    expect(
      screen.getByText(
        "Discover Weekly and other Spotify-made lists need a copy in your library first.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("RULES")).toBeTruthy();
  });

  it("disables a too-large source so it can't be picked", async () => {
    render(<MixBuilder mix={null} />);
    fireEvent.change(screen.getByPlaceholderText("Name this mix"), { target: { value: "Gym" } });
    fireEvent.click(screen.getByRole("button", { name: /pick a source/i }));
    const big = await screen.findByRole("button", { name: /Everything/ });
    expect(screen.getByText("1200 songs · over the 600 limit")).toBeTruthy();
    expect((big as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(big);
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/mixes" && i?.method === "POST")).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: /Liked Songs/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mixes/m1"));
    const post = fetchMock.mock.calls.find(([u, i]) => u === "/api/mixes" && i?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      name: "Gym",
      source: { type: "liked", id: null },
    });
  });
});
