import { SpotifyAuthError } from "@rulemix/spotify";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string = code,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function body(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Maps an error to the JSON error shape. Messages are user-facing; never tokens or stacks. */
export function jsonError(e: unknown): Response {
  if (e instanceof HttpError) return body(e.status, e.code, e.message);
  if (e instanceof SpotifyAuthError)
    return body(401, "reauth_required", "Please sign in with Spotify again.");
  console.error("[http] unhandled error", e instanceof Error ? e.name : typeof e);
  return body(500, "internal", "Something went wrong. Try again.");
}
