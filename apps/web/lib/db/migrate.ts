import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";

export const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../../supabase/migrations/", import.meta.url),
);

export interface MigrateOptions {
  dir?: string;
  log?: (msg: string) => void;
}

/** Applies supabase/migrations/*.sql in filename order, one transaction each; skips applied versions. */
export async function migrate(sql: postgres.Sql, opts: MigrateOptions = {}): Promise<string[]> {
  const dir = opts.dir ?? MIGRATIONS_DIR;
  const log = opts.log ?? ((m: string) => console.log(m));
  await sql`create table if not exists schema_migrations (
    version text primary key, applied_at timestamptz default now())`;
  const applied = new Set(
    (await sql<{ version: string }[]>`select version from schema_migrations`).map((r) => r.version),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const body = await readFile(`${dir}/${file}`, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (version) values (${version})`;
    });
    log(file);
    ran.push(file);
  }
  return ran;
}
