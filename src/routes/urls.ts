import { Router } from 'express';
import { makeUrlController } from '../controllers/urlController';
import { UrlStore } from '../storage/urlStore';
import { UrlCache } from '../cache/urlCache';

export function makeUrlRouter(store: UrlStore, cache: UrlCache): Router {
  const router = Router();
  const ctrl = makeUrlController(store, cache);

  router.post('/', ctrl.createShortUrl);
  router.get('/', ctrl.listUrls);
  router.get('/:code/stats', ctrl.getUrlStats);
  router.delete('/:code', ctrl.deleteUrl);

  return router;
}
