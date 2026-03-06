import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import Joi from 'joi';
import { UrlStore } from '../storage/urlStore';
import { UrlCache } from '../cache/urlCache';

const createSchema = Joi.object({
  url: Joi.string().uri().required(),
  title: Joi.string().max(200).optional(),
  custom_code: Joi.string().alphanum().min(3).max(20).optional(),
  expires_at: Joi.string().isoDate().optional(),
});

export function makeUrlController(store: UrlStore, cache: UrlCache) {
  async function createShortUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const shortCode = value.custom_code || nanoid(8);
      const existing = await store.findByCode(shortCode);
      if (existing) return res.status(409).json({ error: 'Short code already in use' });

      const record = await store.save({
        id: nanoid(),
        short_code: shortCode,
        original_url: value.url,
        title: value.title,
        expires_at: value.expires_at ? new Date(value.expires_at) : undefined,
      });

      await cache.set(shortCode, record);

      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      res.status(201).json({ ...record, short_url: `${baseUrl}/${shortCode}` });
    } catch (err) { next(err); }
  }

  async function redirectToUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      let record = await cache.get(code);

      if (!record) {
        record = await store.findByCode(code);
        if (record) await cache.set(code, record);
      }

      if (!record) return res.status(404).json({ error: 'Short URL not found' });

      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Short URL has expired' });
      }

      await store.incrementClicks(code);
      res.redirect(301, record.original_url);
    } catch (err) { next(err); }
  }

  async function getUrlStats(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await store.findByCode(req.params.code);
      if (!record) return res.status(404).json({ error: 'Short URL not found' });
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      res.json({ ...record, short_url: `${baseUrl}/${record.short_code}` });
    } catch (err) { next(err); }
  }

  async function listUrls(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const { records, total } = await store.listAll(limit, (page - 1) * limit);
      res.json({ records, total, page, limit });
    } catch (err) { next(err); }
  }

  async function deleteUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = await store.delete(req.params.code);
      if (!deleted) return res.status(404).json({ error: 'Short URL not found' });
      await cache.del(req.params.code);
      res.status(204).send();
    } catch (err) { next(err); }
  }

  return { createShortUrl, redirectToUrl, getUrlStats, listUrls, deleteUrl };
}
