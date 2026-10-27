export interface ShortUrl {
  code: string;
  longUrl: string;
  createdAt: Date;
  clicks: number;
  lastClickedAt: Date | null;
}

export interface UrlRepository {
  create(input: { code: string; longUrl: string; createdAt: Date }): Promise<ShortUrl>;
  findByCode(code: string): Promise<ShortUrl | null>;
  findByLongUrl(longUrl: string): Promise<ShortUrl | null>;
  /** Atomic-ish increment; returns updated row or null when the code does not exist. */
  recordClick(code: string, at: Date): Promise<ShortUrl | null>;
  remove(code: string): Promise<boolean>;
  close(): Promise<void>;
}

/** In-memory repository: deterministic unit/integration tests without a database. */
export class InMemoryUrlRepository implements UrlRepository {
  private rows = new Map<string, ShortUrl>();

  async create({ code, longUrl, createdAt }: { code: string; longUrl: string; createdAt: Date }) {
    const row: ShortUrl = { code, longUrl, createdAt, clicks: 0, lastClickedAt: null };
    this.rows.set(code, row);
    return { ...row };
  }

  async findByCode(code: string) {
    const row = this.rows.get(code);
    return row ? { ...row } : null;
  }

  async findByLongUrl(longUrl: string) {
    for (const row of this.rows.values()) {
      if (row.longUrl === longUrl) return { ...row };
    }
    return null;
  }

  async recordClick(code: string, at: Date) {
    const row = this.rows.get(code);
    if (!row) return null;
    row.clicks += 1;
    row.lastClickedAt = at;
    return { ...row };
  }

  async remove(code: string) {
    return this.rows.delete(code);
  }

  async close() {
    /* nothing to release */
  }
}
