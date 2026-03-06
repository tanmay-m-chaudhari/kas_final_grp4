import { Router } from 'express';
import { listCategories, getCategory, createCategory } from '../controllers/categoryController';

const router = Router();
router.get('/', listCategories);
router.get('/:slug', getCategory);
router.post('/', createCategory);
export default router;
