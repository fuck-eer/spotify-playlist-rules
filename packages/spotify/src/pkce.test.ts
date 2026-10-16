import { describe, expect, it } from "vitest";
import { challengeFor, createPkcePair } from "./pkce.js";

describe("createPkcePair", () => {
  it("makes a 64-char base64url verifier with a matching challenge", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(challenge).toBe(challengeFor(verifier));
  });

  it("makes a fresh verifier each time", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});

describe("challengeFor", () => {
  it("matches the RFC 7636 appendix B test vector", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});
