export class SpotifyError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.body = body;
  }
}
/** 401 after a refresh, or `invalid_grant`. */
export class SpotifyAuthError extends SpotifyError {}
/** 403. */
export class SpotifyForbiddenError extends SpotifyError {}
/** 404. */
export class SpotifyNotFoundError extends SpotifyError {}
/** 429 after all retries. */
export class SpotifyRateLimitError extends SpotifyError {}
/** Any other status >= 400. */
export class SpotifyHttpError extends SpotifyError {}
