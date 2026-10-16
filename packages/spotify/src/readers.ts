import type { SpotifyClient } from "./client.js";

/** Spotify's maximum page size for playlist items and saved tracks (spec A6). */
const PAGE = 50;
const ITEM_FIELDS =
  "total,next,items(is_local,item(uri,name,type,is_playable,restrictions,artists(name),album(images)),track(uri,name,type,is_playable,restrictions,artists(name),album(images)))";

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
  /** Album image closest to 300 px wide, else the first, else null. */
  imageUrl: string | null;
}

interface RawImage {
  url?: string | null;
  width?: number | null;
}

/** The album image closest to 300 px wide; images without a width only count if nothing else does. */
export function pickImage(images: RawImage[] | null | undefined): string | null {
  const withUrl = (images ?? []).filter((i): i is RawImage & { url: string } => !!i?.url);
  if (withUrl.length === 0) return null;
  const sized = withUrl.filter((i) => typeof i.width === "number");
  if (sized.length === 0) return withUrl[0]!.url;
  let best = sized[0]!;
  for (const i of sized) if (Math.abs(i.width! - 300) < Math.abs(best.width! - 300)) best = i;
  return best.url;
}

interface RawTrack {
  uri?: string | null;
  name?: string;
  type?: string;
  is_playable?: boolean;
  restrictions?: { reason?: string } | null;
  artists?: { name?: string }[] | null;
  album?: { images?: RawImage[] | null } | null;
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
  const { data } = await c.request<{
    id: string;
    account_id?: string | null;
    display_name?: string | null;
  }>("GET", "/me");
  return {
    id: data.id,
    accountId: data.account_id ?? null,
    displayName: data.display_name ?? null,
  };
}

/**
 * ADR-0011: local files, non-tracks, entries without a uri, and tracks Spotify
 * marks unplayable (is_playable false or any restriction, e.g. market — these
 * come back nameless with duration 0) are Unavailable tracks (null).
 */
function toTrackItem(entry: RawEntry | null): TrackItem | null {
  if (!entry || entry.is_local) return null;
  const t = entry.item ?? entry.track;
  if (!t || t.type !== "track" || !t.uri) return null;
  if (t.is_playable === false || t.restrictions || !t.name) return null;
  return {
    uri: t.uri,
    name: t.name ?? "",
    artists: (t.artists ?? []).map((a) => a.name ?? ""),
    imageUrl: pickImage(t.album?.images),
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
