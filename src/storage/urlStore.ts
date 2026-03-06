import { Pool } from 'pg';

export interface UrlRecord {
  id: string;
  short_code: string;
  original_url: string;
  title?: string;
  click_count: number;
  created_at: Date;
  expires_at?: Date;
}

export interface UrlStore {
  init(): Promise<void>;
  save(record: Omit<UrlRecord, 'click_count' | 'created_at'>): Promise<UrlRecord>;
  findByCode(shortCode: string): Promise<UrlRecord | null>;
  incrementClicks(shortCode: string): Promise<void>;
  listAll(limit: number, offset: number): Promise<{ records: UrlRecord[]; total: number }>;
  delete(shortCode: string): Promise<boolean>;
}

export class PostgresUrlStore implements UrlStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10 });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS short_urls (
        id TEXT PRIMARY KEY,
        short_code TEXT UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        title TEXT,
        click_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code)`);
  }

  async save(record: Omit<UrlRecord, 'click_count' | 'created_at'>): Promise<UrlRecord> {
    const res = await this.pool.query(
      `INSERT INTO short_urls (id, short_code, original_url, title, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [record.id, record.short_code, record.original_url, record.title ?? null, record.expires_at ?? null]
    );
    return res.rows[0];
  }

  async findByCode(shortCode: string): Promise<UrlRecord | null> {
    const res = await this.pool.query(`SELECT * FROM short_urls WHERE short_code = $1`, [shortCode]);
    return res.rows[0] ?? null;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    await this.pool.query(`UPDATE short_urls SET click_count = click_count + 1 WHERE short_code = $1`, [shortCode]);
  }

  async listAll(limit: number, offset: number): Promise<{ records: UrlRecord[]; total: number }> {
    const [rows, count] = await Promise.all([
      this.pool.query(`SELECT * FROM short_urls ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      this.pool.query(`SELECT COUNT(*) FROM short_urls`),
    ]);
    return { records: rows.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async delete(shortCode: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM short_urls WHERE short_code = $1 RETURNING id`, [shortCode]);
    return (res.rowCount ?? 0) > 0;
  }
}

export class InMemoryUrlStore implements UrlStore {
  private store: Map<string, UrlRecord> = new Map();

  async init(): Promise<void> {}

  async save(record: Omit<UrlRecord, 'click_count' | 'created_at'>): Promise<UrlRecord> {
    const full: UrlRecord = { ...record, click_count: 0, created_at: new Date() };
    this.store.set(record.short_code, full);
    return full;
  }

  async findByCode(shortCode: string): Promise<UrlRecord | null> {
    return this.store.get(shortCode) ?? null;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    const record = this.store.get(shortCode);
    if (record) record.click_count++;
  }

  async listAll(limit: number, offset: number): Promise<{ records: UrlRecord[]; total: number }> {
    const all = Array.from(this.store.values()).sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return { records: all.slice(offset, offset + limit), total: all.length };
  }

  async delete(shortCode: string): Promise<boolean> {
    return this.store.delete(shortCode);
  }
}
