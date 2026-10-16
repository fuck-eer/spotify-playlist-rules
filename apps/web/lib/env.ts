import { z } from "zod";

const limit = (def: number) => z.coerce.number().int().min(1).default(def);

const EnvSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url().default("http://127.0.0.1:3000/api/auth/callback"),
  SPOTIFY_ACCOUNTS_BASE_URL: z.string().url().default("https://accounts.spotify.com"),
  SPOTIFY_API_BASE_URL: z.string().url().default("https://api.spotify.com/v1"),
  APP_URL: z.string().url().default("http://127.0.0.1:3000"),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@127.0.0.1:54322/rulemix"),
  TEST_DATABASE_URL: z
    .string()
    .url()
    .default("postgres://postgres:postgres@127.0.0.1:54322/rulemix_test"),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64"),
  SESSION_SECRET: z.string().min(32),
  MAX_RULES_PER_MIX: limit(10),
  MAX_SOURCE_TRACKS: limit(600),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated server env, parsed on first use. Error messages name variables, never values. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
