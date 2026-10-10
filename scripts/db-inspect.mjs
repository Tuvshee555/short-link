// Read-only: prints which database we're connected to and which tables exist.
// Usage: npx dotenv -e .env.local -- node scripts/db-inspect.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
try {
  const [info] = await db.$queryRaw`select current_database() as db, current_user as usr`;
  console.log(`connected: ${info.db} as ${info.usr}`);
  const tables = await db.$queryRaw`
    select table_schema, table_name from information_schema.tables
    where table_schema not in ('pg_catalog', 'information_schema') order by 1, 2`;
  console.log("tables:", tables.length ? tables.map((t) => `${t.table_schema}.${t.table_name}`).join(", ") : "(none — empty database)");
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
