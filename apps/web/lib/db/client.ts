import postgres from "postgres";
import { env } from "../env";

let singleton: postgres.Sql | undefined;

export function createSql(url: string): postgres.Sql {
  return postgres(url, { onnotice: () => {} });
}

export function getSql(): postgres.Sql {
  singleton ??= createSql(env().DATABASE_URL);
  return singleton;
}
