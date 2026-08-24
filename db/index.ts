import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type DatabaseBinding = Parameters<typeof drizzle>[0];

export function getDb(
  database = (env as unknown as { DB?: DatabaseBinding }).DB,
) {
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Pass the worker binding to getDb(env.DB) before using the database.",
    );
  }

  return drizzle(database, { schema });
}
