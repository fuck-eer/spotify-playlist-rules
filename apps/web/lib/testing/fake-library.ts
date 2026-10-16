import type { FakeSpotify } from "@rulemix/spotify/testing";

export const FAKE_ME = "spotify-user-1";

const track = (id: string, name: string, artist: string) => ({
  uri: `spotify:track:${id}`,
  name,
  type: "track",
  artists: [{ name: artist }],
});
export const FAKE_TRACKS = {
  sunrise: track("sunrise", "Sunrise", "Kavi"),
  bassline: track("bassline", "Bassline", "Mira"),
  echo: track("echo", "Echo", "Kavi"),
  drift: track("drift", "Drift", "Oren"),
};
const { sunrise, bassline, echo, drift } = FAKE_TRACKS;
/** Liked Songs: Sunrise, Bassline, Sunrise again (a duplicate). */
const LIKED_ITEMS = [{ track: sunrise }, { track: bassline }, { track: sunrise }];
/** "Gym bangers": Echo, a local file, Drift, Sunrise. */
const OWN_ITEMS = [
  { item: echo },
  { is_local: true, item: null },
  { item: drift },
  { item: sunrise },
];

/** A small Spotify library on the fake server: Liked (3), owned (4), collab (9), followed (2). */
export function installFakeLibrary(fake: FakeSpotify, likedTotal = 3): void {
  const playlists = [
    {
      id: "pl-own",
      name: "Gym bangers",
      owner: { id: FAKE_ME, display_name: "Nishchay" },
      items: { total: 4 },
    },
    {
      id: "pl-collab",
      name: "Road trip",
      collaborative: true,
      owner: { id: "friend", display_name: "Asha" },
      items: { total: 9 },
    },
    {
      id: "pl-followed",
      name: "Today's Top Hits",
      owner: { id: "spotify", display_name: "Spotify" },
      items: { total: 2 },
    },
  ];
  fake.on("POST", /^\/api\/token$/, () => ({
    body: { access_token: "fake-access", expires_in: 3600, scope: "" },
  }));
  fake.on("GET", /\/me$/, () => ({ body: { id: FAKE_ME, display_name: "Nishchay" } }));
  fake.on("GET", /\/me\/tracks$/, (req) => ({
    body: {
      total: likedTotal,
      next: null,
      items: req.query.get("limit") === "1" ? LIKED_ITEMS.slice(0, 1) : LIKED_ITEMS,
    },
  }));
  fake.on("GET", /\/playlists\/pl-own\/items$/, () => ({
    body: { total: OWN_ITEMS.length, next: null, items: OWN_ITEMS },
  }));
  fake.on("GET", /\/me\/playlists$/, () => ({ body: { total: 3, next: null, items: playlists } }));
  fake.on("GET", /\/playlists\/[^/]+$/, (req) => {
    const p = playlists.find((x) => req.path.endsWith(`/${x.id}`));
    return p ? { body: { items: p.items } } : { status: 404, body: { error: { status: 404 } } };
  });
}
