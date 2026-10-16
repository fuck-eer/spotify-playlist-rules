import type { SpotifyClient } from "./client.js";

/** Spotify's maximum page size for playlist items and saved tracks (spec A6). */
const PAGE = 50;
const ITEM_FIELDS =
  "total,next,items(is_local,item(uri,name,type,artists(name)),track(uri,name,type,artists(name)))";

export interface Me {
  id: string;
  accountId: string | null;
  displayName: string | null;
}

export interface SourceOption {
  type: "playlist" | "liked";
  id: string | null;
  name: string;
  trackCount: number;
  imageUrl: string | null;
  ownerName: string;
}

export type ReadProgress = (done: number, total: number) => void;

export interface TrackItem {
  uri: string;
  name: string;
  artists: string[];
}

interface RawTrack {
  uri?: string | null;
  name?: string;
  type?: string;
  artists?: { name?: string }[] | null;
}
interface RawEntry {
  is_local?: boolean;
  item?: RawTrack | null;
  track?: RawTrack | null;
}
interface RawPage<T> {
  total?: number;
  next?: string | null;
  items?: (T | null)[];
}
interface RawPlaylist {
  id: string;
  name?: string;
  collaborative?: boolean;
  owner?: { id?: string; display_name?: string | null } | null;
  items?: { total?: number } | null;
  tracks?: { total?: number } | null;
  images?: { url?: string }[] | null;
}

export async function getMe(c: SpotifyClient): Promise<Me> {
  const { data } = await c.request<{ id: string; account_id?: string | null; display_name?: string | null }>(
    "GET",
    "/me",
  );
  return { id: data.id, accountId: data.account_id ?? null, displayName: data.display_name ?? null };
}

/** ADR-0011: local files, non-tracks, and entries without a uri are Unavailable tracks (null). */
function toTrackItem(entry: RawEntry | null): TrackItem | null {
  if (!entry || entry.is_local) return null;
  const t = entry.item ?? entry.track;
  if (!t || t.type !== "track" || !t.uri) return null;
  return {
    uri: t.uri,
    name: t.name ?? "",
    artists: (t.artists ?? []).map((a) => a.name ?? ""),
  };
}

async function readPaged(
  c: SpotifyClient,
  pathFor: (offset: number) => string,
  onProgress?: ReadProgress,
): Promise<(TrackItem | null)[]> {
  const out: (TrackItem | null)[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await c.request<RawPage<RawEntry>>("GET", pathFor(offset));
    const items = data.items ?? [];
    for (const e of items) out.push(toTrackItem(e));
    const total = data.total ?? out.length;
    onProgress?.(out.length, total);
    if (items.length === 0 || !data.next || out.length >= total) return out;
  }
}

export function readPlaylistItems(
  c: SpotifyClient,
  playlistId: string,
  onProgress?: ReadProgress,
): Promise<(TrackItem | null)[]> {
  const id = encodeURIComponent(playlistId);
  const fields = encodeURIComponent(ITEM_FIELDS);
  return readPaged(
    c,
    (offset) => `/playlists/${id}/items?limit=${PAGE}&offset=${offset}&fields=${fields}`,
    onProgress,
  );
}

export function readLikedSongs(
  c: SpotifyClient,
  onProgress?: ReadProgress,
): Promise<(TrackItem | null)[]> {
  return readPaged(c, (offset) => `/me/tracks?limit=${PAGE}&offset=${offset}`, onProgress);
}

async function likedTotal(c: SpotifyClient): Promise<number> {
  const { data } = await c.request<RawPage<unknown>>("GET", "/me/tracks?limit=1");
  return data.total ?? 0;
}

/** Liked Songs first, then owned and collaborative playlists in API order. Followed ones are hidden (ADR-0014). */
export async function listSources(c: SpotifyClient, meId: string): Promise<SourceOption[]> {
  const [likedCount, me] = await Promise.all([likedTotal(c), getMe(c)]);
  const out: SourceOption[] = [
    {
      type: "liked",
      id: null,
      name: "Liked Songs",
      trackCount: likedCount,
      imageUrl: null,
      ownerName: me.displayName ?? me.id,
    },
  ];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await c.request<RawPage<RawPlaylist>>(
      "GET",
      `/me/playlists?limit=${PAGE}&offset=${offset}`,
    );
    const items = data.items ?? [];
    for (const p of items) {
      if (!p) continue;
      if (p.owner?.id !== meId && p.collaborative !== true) continue;
      out.push({
        type: "playlist",
        id: p.id,
        name: p.name ?? "",
        trackCount: p.items?.total ?? p.tracks?.total ?? 0,
        imageUrl: p.images?.[0]?.url ?? null,
        ownerName: p.owner?.display_name ?? p.owner?.id ?? "",
      });
    }
    if (items.length === 0 || !data.next) return out;
  }
}

export async function getSourceTrackCount(
  c: SpotifyClient,
  source: { type: "playlist" | "liked"; id: string | null },
): Promise<number> {
  if (source.type === "liked") return likedTotal(c);
  if (!source.id) throw new TypeError("playlist source needs an id");
  const fields = encodeURIComponent("items(total),tracks(total)");
  const { data } = await c.request<Pick<RawPlaylist, "items" | "tracks">>(
    "GET",
    `/playlists/${encodeURIComponent(source.id)}?fields=${fields}`,
  );
  return data.items?.total ?? data.tracks?.total ?? 0;
}
