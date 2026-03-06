import IORedis from 'ioredis';
import { UrlRecord } from '../storage/urlStore';

export interface UrlCache {
  get(shortCode: string): Promise<UrlRecord | null>;
  set(shortCode: string, record: UrlRecord, ttlSeconds?: number): Promise<void>;
  del(shortCode: string): Promise<void>;
}

export class RedisUrlCache implements UrlCache {
  private client: IORedis;

  constructor(redisUrl: string) {
    this.client = new IORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async get(shortCode: string): Promise<UrlRecord | null> {
    const raw = await this.client.get(`url:${shortCode}`);
    return raw ? JSON.parse(raw) : null;
  }

  async set(shortCode: string, record: UrlRecord, ttlSeconds = 3600): Promise<void> {
    await this.client.setex(`url:${shortCode}`, ttlSeconds, JSON.stringify(record));
  }

  async del(shortCode: string): Promise<void> {
    await this.client.del(`url:${shortCode}`);
  }
}

export class NoOpUrlCache implements UrlCache {
  async get(_shortCode: string): Promise<null> { return null; }
  async set(_shortCode: string, _record: UrlRecord): Promise<void> {}
  async del(_shortCode: string): Promise<void> {}
}
