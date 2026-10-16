import type { FakeSpotify } from "@rulemix/spotify/testing";

export interface FakeWrites {
  /** Playlist ids that no longer exist in the user's library. */
  missing: Set<string>;
  /** Ids handed out by create, in order. */
  created: string[];
}

/** Write endpoints for the fake Spotify: create, library/contains, replace and append items. */
export function installFakeWrites(fake: FakeSpotify): FakeWrites {
  const state: FakeWrites = { missing: new Set(), created: [] };
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
  fake.on("PUT", /\/playlists\/[^/]+\/items$/, () => ({ body: { snapshot_id: `snap-${++snap}` } }));
  fake.on("POST", /\/playlists\/[^/]+\/items$/, () => ({
    status: 201,
    body: { snapshot_id: `snap-${++snap}` },
  }));
  return state;
}
