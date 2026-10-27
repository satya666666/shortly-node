import { createApp } from "./app.js";
import { PostgresUrlRepository } from "./repositories/postgresUrlRepository.js";
import { InMemoryUrlRepository } from "./repositories/urlRepository.js";
import { Pool } from "pg";

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  const repository =
    process.env.DATABASE_URL && process.env.STORE === "postgres"
      ? await withPostgres(process.env.DATABASE_URL)
      : new InMemoryUrlRepository();

  const app = createApp({ repository });
  app.listen(PORT, () => {
    console.log(`[shortly] listening on :${PORT} (store: ${repository.constructor.name})`);
  });
}

async function withPostgres(connectionString: string) {
  const pool = new Pool({ connectionString });
  const repository = new PostgresUrlRepository(pool);
  await repository.init();
  return repository;
}

main().catch((err) => {
  console.error("[shortly] fatal startup error:", err);
  process.exit(1);
});
