import { resetEnvCache } from "./env";

/** Non-secret test values for the required env vars. */
export const TEST_ENV = {
  SPOTIFY_CLIENT_ID: "test-client-id",
  SPOTIFY_CLIENT_SECRET: "test-client-secret",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  SESSION_SECRET: "s".repeat(40),
} as const;

/** Applies TEST_ENV plus overrides to process.env; returns a restore function. */
export function useTestEnv(overrides: Record<string, string> = {}): () => void {
  const saved = { ...process.env };
  Object.assign(process.env, TEST_ENV, overrides);
  resetEnvCache();
  return () => {
    process.env = saved;
    resetEnvCache();
  };
}
