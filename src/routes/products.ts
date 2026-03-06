import { Router } from 'express';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct, adjustInventory } from '../controllers/productController';

const router = Router();
router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.patch('/:id/inventory', adjustInventory);
export default router;
