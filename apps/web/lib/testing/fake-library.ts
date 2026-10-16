import type { FakeSpotify } from "@rulemix/spotify/testing";

export const FAKE_ME = "spotify-user-1";

/** A small Spotify library on the fake server: Liked (3), owned (4), collab (9), followed (2). */
export function installFakeLibrary(fake: FakeSpotify, likedTotal = 3): void {
  const playlists = [
    { id: "pl-own", name: "Gym bangers", owner: { id: FAKE_ME, display_name: "Nishchay" }, items: { total: 4 } },
    { id: "pl-collab", name: "Road trip", collaborative: true, owner: { id: "friend", display_name: "Asha" }, items: { total: 9 } },
    { id: "pl-followed", name: "Today's Top Hits", owner: { id: "spotify", display_name: "Spotify" }, items: { total: 2 } },
  ];
  fake.on("POST", /^\/api\/token$/, () => ({
    body: { access_token: "fake-access", expires_in: 3600, scope: "" },
  }));
  fake.on("GET", /\/me$/, () => ({ body: { id: FAKE_ME, display_name: "Nishchay" } }));
  fake.on("GET", /\/me\/tracks$/, () => ({ body: { total: likedTotal, next: null, items: [] } }));
  fake.on("GET", /\/me\/playlists$/, () => ({ body: { total: 3, next: null, items: playlists } }));
  fake.on("GET", /\/playlists\/[^/]+$/, (req) => {
    const p = playlists.find((x) => req.path.endsWith(`/${x.id}`));
    return p ? { body: { items: p.items } } : { status: 404, body: { error: { status: 404 } } };
  });
}
