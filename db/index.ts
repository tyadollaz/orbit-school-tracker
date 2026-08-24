import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(database?: Parameters<typeof drizzle>[0]) {
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Pass the worker binding to getDb(env.DB) before using the database."
    );
  }

  return drizzle(database, { schema });
}
