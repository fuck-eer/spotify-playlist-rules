import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, sign, verifySigned } from "./crypto";
import { useTestEnv } from "./test-env";

let restore: () => void = () => {};
afterEach(() => restore());

describe("encrypt/decrypt", () => {
  it("round-trips", () => {
    restore = useTestEnv();
    const t = encrypt("refresh-abc");
    expect(t.startsWith("v1.")).toBe(true);
    expect(t.split(".")).toHaveLength(4);
    expect(decrypt(t)).toBe("refresh-abc");
  });

  it("gives a different ciphertext each time", () => {
    restore = useTestEnv();
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("throws on a tampered ciphertext", () => {
    restore = useTestEnv();
    const [v, iv, tag, ct] = encrypt("secret-value").split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("throws with a wrong key length", () => {
    restore = useTestEnv({ TOKEN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString("base64") });
    expect(() => encrypt("x")).toThrow();
  });
});

describe("sign/verifySigned", () => {
  it("verifies a signed value", () => {
    restore = useTestEnv();
    expect(verifySigned(sign("hello.world"))).toBe("hello.world");
  });

  it("returns null for a tampered value", () => {
    restore = useTestEnv();
    const s = sign("hello");
    expect(verifySigned(s.replace("hello", "hellp"))).toBeNull();
    expect(verifySigned("nodot")).toBeNull();
  });
});
