import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PostgresUrlStore, InMemoryUrlStore } from './storage/urlStore';
import { RedisUrlCache, NoOpUrlCache } from './cache/urlCache';
import { makeUrlRouter } from './routes/urls';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function buildDependencies() {
  let store: PostgresUrlStore | InMemoryUrlStore;
  let cache: RedisUrlCache | NoOpUrlCache;

  if (process.env.DATABASE_URL) {
    const pgStore = new PostgresUrlStore(process.env.DATABASE_URL);
    await pgStore.init();
    store = pgStore;
  } else {
    store = new InMemoryUrlStore();
  }

  if (process.env.REDIS_URL) {
    cache = new RedisUrlCache(process.env.REDIS_URL);
  } else {
    cache = new NoOpUrlCache();
  }

  return { store, cache };
}

async function bootstrap() {
  const { store, cache } = await buildDependencies();

  app.get('/health', (_req, res) => {
    const mode = {
      storage: process.env.DATABASE_URL ? 'postgres' : 'in-memory',
      cache: process.env.REDIS_URL ? 'redis' : 'disabled',
    };
    res.json({ status: 'ok', service: 'url-shortener', mode, timestamp: new Date().toISOString() });
  });

  app.use('/api/urls', makeUrlRouter(store, cache));

  app.get('/:code', async (req, res, next) => {
    try {
      const record = await cache.get(req.params.code) || await store.findByCode(req.params.code);
      if (!record) return res.status(404).json({ error: 'Short URL not found' });
      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Short URL has expired' });
      }
      await store.incrementClicks(req.params.code);
      res.redirect(301, record.original_url);
    } catch (err) { next(err); }
  });

  app.use(errorHandler);

  app.listen(PORT, () => {
    process.stdout.write(`URL shortener running on port ${PORT}\n`);
  });
}

bootstrap().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
