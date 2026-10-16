import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env, resetEnvCache } from "./env";

const BASE = {
  SPOTIFY_CLIENT_ID: "cid",
  SPOTIFY_CLIENT_SECRET: "secret",
  DATABASE_URL: "postgres://u:p@127.0.0.1:54322/rulemix",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  SESSION_SECRET: "x".repeat(32),
};

describe("env()", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => {
    saved = { ...process.env };
    for (const k of ["MAX_RULES_PER_MIX", "MAX_SOURCE_TRACKS", "TOKEN_ENCRYPTION_KEY"])
      delete process.env[k];
    resetEnvCache();
  });
  afterEach(() => {
    process.env = saved;
    resetEnvCache();
  });

  it("defaults MAX_RULES_PER_MIX to 10 and MAX_SOURCE_TRACKS to 600", () => {
    Object.assign(process.env, BASE);
    expect(env().MAX_RULES_PER_MIX).toBe(10);
    expect(env().MAX_SOURCE_TRACKS).toBe(600);
  });

  it("coerces configured limits to numbers", () => {
    Object.assign(process.env, BASE, { MAX_RULES_PER_MIX: "4", MAX_SOURCE_TRACKS: "50" });
    expect(env().MAX_RULES_PER_MIX).toBe(4);
    expect(env().MAX_SOURCE_TRACKS).toBe(50);
  });

  it("throws when TOKEN_ENCRYPTION_KEY is missing", () => {
    Object.assign(process.env, BASE);
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => env()).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});
