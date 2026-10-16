import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

const VERSION = "v1";

function key(): Buffer {
  const k = Buffer.from(env().TOKEN_ENCRYPTION_KEY, "base64");
  if (k.length !== 32) throw new RangeError("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return k;
}

/** AES-256-GCM; output `v1.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decrypt(token: string): string {
  const [v, iv, tag, ct] = token.split(".");
  if (v !== VERSION || !iv || !tag || ct === undefined)
    throw new TypeError("Malformed encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString(
    "utf8",
  );
}

function mac(value: string): Buffer {
  return createHmac("sha256", env().SESSION_SECRET).update(value).digest();
}

/** HMAC-SHA256: `<value>.<sig b64url>`. */
export function sign(value: string): string {
  return `${value}.${mac(value).toString("base64url")}`;
}

export function verifySigned(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const sig = Buffer.from(signed.slice(i + 1), "base64url");
  const expected = mac(value);
  return sig.length === expected.length && timingSafeEqual(sig, expected) ? value : null;
}
