import { createHash, randomBytes } from "node:crypto";

/** RFC 7636 S256 code challenge: base64url(sha256(verifier)). Exported for tests. */
export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** A fresh PKCE pair. 48 random bytes encode to exactly 64 base64url chars. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: challengeFor(verifier) };
}
