/** Opens a URL in this tab; open.spotify.com links hand off to the Spotify app on phones (ADR-0022). */
export function openExternal(url: string): void {
  window.location.assign(url);
}
