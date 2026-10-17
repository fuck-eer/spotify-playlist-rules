import type { FakeSpotify } from "@rulemix/spotify/testing";

export interface FakeWrites {
  /** Playlist ids that no longer exist in the user's library. */
  missing: Set<string>;
  /** Ids handed out by create, in order. */
  created: string[];
  /** Item writes in order: replace (PUT) and append (POST), with their uris. */
  items: { method: string; playlistId: string; uris: string[] }[];
}

/** Write endpoints for the fake Spotify: create, library/contains, replace and append items. */
export function installFakeWrites(fake: FakeSpotify): FakeWrites {
  const state: FakeWrites = { missing: new Set(), created: [], items: [] };
  let snap = 0;
  fake.on("POST", /\/me\/playlists$/, () => {
    const id = `tgt-${state.created.length + 1}`;
    state.created.push(id);
    return { status: 201, body: { id } };
  });
  fake.on("GET", /\/me\/library\/contains$/, (req) => {
    const id = (req.query.get("uris") ?? "").replace("spotify:playlist:", "");
    return { body: [!state.missing.has(id)] };
  });
  const record = (req: { method: string; path: string; json: unknown }) => {
    const uris = (req.json as { uris?: string[] } | null)?.uris ?? [];
    state.items.push({ method: req.method, playlistId: req.path.split("/")[3] ?? "", uris });
  };
  fake.on("PUT", /\/playlists\/[^/]+\/items$/, (req) => {
    record(req);
    return { body: { snapshot_id: `snap-${++snap}` } };
  });
  fake.on("POST", /\/playlists\/[^/]+\/items$/, (req) => {
    record(req);
    return { status: 201, body: { snapshot_id: `snap-${++snap}` } };
  });
  // e2e inspection only (never a Spotify path).
  fake.on("GET", /\/__test\/items$/, () => ({ body: state.items }));
  return state;
}
