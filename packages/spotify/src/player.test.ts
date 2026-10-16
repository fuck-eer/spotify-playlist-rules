import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startFakeSpotify, type FakeSpotify } from "../test/fake-spotify.js";
import { createClient, type SpotifyClient } from "./client.js";
import {
  PLAYER_PLAYLIST_DESCRIPTION,
  PLAYER_PLAYLIST_NAME,
  findActiveDevice,
  hasPlaybackScopes,
  isPlaying,
  startPlaylistPlayback,
} from "./player.js";
import { writeTarget } from "./writer.js";

let fake: FakeSpotify;
let c: SpotifyClient;

beforeEach(async () => {
  fake = await startFakeSpotify();
  c = createClient(
    {
      clientId: "c",
      clientSecret: "s",
      redirectUri: "r",
      accountsBaseUrl: fake.url,
      apiBaseUrl: `${fake.url}/v1`,
    },
    {
      get: () =>
        Promise.resolve({
          accessToken: "AT",
          refreshToken: "RT",
          expiresAt: Date.now() + 3_600_000,
          scope: "",
        }),
      set: () => Promise.resolve(),
    },
  );
});
afterEach(() => fake.close());

describe("Player playlist constants", () => {
  it("names the playlist rulemix player, managed by rulemix", () => {
    expect(PLAYER_PLAYLIST_NAME).toBe("rulemix player");
    expect(PLAYER_PLAYLIST_DESCRIPTION).toBe("Managed by rulemix. Play with shuffle off.");
  });
});

describe("writeTarget description", () => {
  beforeEach(() => {
    fake.on("POST", /^\/v1\/me\/playlists$/, () => ({ status: 201, body: { id: "p1" } }));
    fake.on("PUT", /\/items$/, () => ({ body: { snapshot_id: "s" } }));
  });
  const created = () =>
    fake.calls.find((x) => x.method === "POST" && x.path === "/v1/me/playlists")?.json;

  it("sends the given description when creating", async () => {
    await writeTarget(c, {
      targetPlaylistId: null,
      defaultName: PLAYER_PLAYLIST_NAME,
      description: PLAYER_PLAYLIST_DESCRIPTION,
      uris: ["spotify:track:a"],
    });
    expect(created()).toEqual({
      name: "rulemix player",
      public: false,
      description: "Managed by rulemix. Play with shuffle off.",
    });
  });

  it("keeps the Target description by default", async () => {
    await writeTarget(c, { targetPlaylistId: null, defaultName: "Rules: Gym", uris: [] });
    expect(created()).toMatchObject({ description: "Made by rulemix. Play with shuffle off." });
  });
});

describe("findActiveDevice", () => {
  const devices = (list: unknown[]) =>
    fake.on("GET", /^\/v1\/me\/player\/devices$/, () => ({ body: { devices: list } }));

  it("returns the active device", async () => {
    devices([
      { id: "d1", is_active: false },
      { id: "d2", is_active: true },
    ]);
    expect(await findActiveDevice(c)).toEqual({ id: "d2" });
  });
  it("returns null when none is active", async () => {
    devices([{ id: "d1", is_active: false }]);
    expect(await findActiveDevice(c)).toBeNull();
  });
  it("ignores an active device without an id", async () => {
    devices([{ id: null, is_active: true }]);
    expect(await findActiveDevice(c)).toBeNull();
  });
});

describe("startPlaylistPlayback", () => {
  it("turns shuffle off, then plays the playlist as a context on the device", async () => {
    fake.on("PUT", /^\/v1\/me\/player\/shuffle$/, () => ({ status: 204 }));
    fake.on("PUT", /^\/v1\/me\/player\/play$/, () => ({ status: 204 }));
    await startPlaylistPlayback(c, { deviceId: "D 1", playlistId: "pl1" });
    const [shuffle, play] = fake.calls;
    expect(shuffle?.path).toBe("/v1/me/player/shuffle");
    expect(Object.fromEntries(shuffle!.query)).toEqual({ state: "false", device_id: "D 1" });
    expect(play?.path).toBe("/v1/me/player/play");
    expect(play?.query.get("device_id")).toBe("D 1");
    expect(play?.json).toEqual({ context_uri: "spotify:playlist:pl1" });
  });
});

describe("isPlaying", () => {
  const current = (r: { status?: number; body?: unknown }) =>
    fake.on("GET", /^\/v1\/me\/player\/currently-playing$/, () => r);
  it("is false on 204", async () => {
    current({ status: 204 });
    expect(await isPlaying(c)).toBe(false);
  });
  it("is false when paused", async () => {
    current({ body: { is_playing: false } });
    expect(await isPlaying(c)).toBe(false);
  });
  it("is true when playing", async () => {
    current({ body: { is_playing: true } });
    expect(await isPlaying(c)).toBe(true);
  });
});

describe("hasPlaybackScopes", () => {
  it("needs both playback scopes", () => {
    expect(
      hasPlaybackScopes("user-library-read user-read-playback-state user-modify-playback-state"),
    ).toBe(true);
    expect(hasPlaybackScopes("user-read-playback-state")).toBe(false);
    expect(hasPlaybackScopes("")).toBe(false);
  });
});
