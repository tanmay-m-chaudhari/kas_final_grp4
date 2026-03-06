import { Router } from 'express';
import { listOrders, getOrder, createOrder, updateOrderStatus, cancelOrder } from '../controllers/orderController';

const router = Router();
router.get('/', listOrders);
router.get('/:id', getOrder);
router.post('/', createOrder);
router.patch('/:id/status', updateOrderStatus);
router.post('/:id/cancel', cancelOrder);
export default router;
