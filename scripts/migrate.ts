import { createSql } from "../apps/web/lib/db/client";
import { migrate } from "../apps/web/lib/db/migrate";

const i = process.argv.indexOf("--url");
const url = i >= 0 ? process.argv[i + 1] : process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL (or --url) is required");
  process.exit(1);
}
const sql = createSql(url);
try {
  await migrate(sql);
} finally {
  await sql.end();
}
