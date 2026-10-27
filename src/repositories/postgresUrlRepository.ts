import type { Pool } from "pg";
import type { ShortUrl, UrlRepository } from "./urlRepository.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS short_urls (
  code           TEXT PRIMARY KEY,
  long_url       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  clicks         INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  last_clicked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_short_urls_long_url ON short_urls (long_url);
`;

interface Row {
  code: string;
  long_url: string;
  created_at: Date;
  clicks: number;
  last_clicked_at: Date | null;
}

function toDomain(r: Row): ShortUrl {
  return {
    code: r.code,
    longUrl: r.long_url,
    createdAt: r.created_at,
    clicks: r.clicks,
    lastClickedAt: r.last_clicked_at,
  };
}

/**
 * PostgreSQL repository. The click counter is incremented in SQL so two
 * concurrent redirects can never lose a click (read-modify-write in app code would).
 */
export class PostgresUrlRepository implements UrlRepository {
  constructor(private readonly pool: Pool) {}

  async init(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async create({ code, longUrl, createdAt }: { code: string; longUrl: string; createdAt: Date }) {
    const result = await this.pool.query<Row>(
      `INSERT INTO short_urls (code, long_url, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING RETURNING *`,
      [code, longUrl, createdAt]
    );
    if (result.rows.length === 0) throw new Error("CODE_TAKEN");
    return toDomain(result.rows[0]);
  }

  async findByCode(code: string) {
    const result = await this.pool.query<Row>(`SELECT * FROM short_urls WHERE code = $1`, [code]);
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  async findByLongUrl(longUrl: string) {
    const result = await this.pool.query<Row>(
      `SELECT * FROM short_urls WHERE long_url = $1 ORDER BY created_at LIMIT 1`,
      [longUrl]
    );
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  async recordClick(code: string, at: Date) {
    const result = await this.pool.query<Row>(
      `UPDATE short_urls
       SET clicks = clicks + 1, last_clicked_at = $2
       WHERE code = $1
       RETURNING *`,
      [code, at]
    );
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  async remove(code: string) {
    const result = await this.pool.query(`DELETE FROM short_urls WHERE code = $1`, [code]);
    return (result.rowCount ?? 0) > 0;
  }

  async close() {
    await this.pool.end();
  }
}
