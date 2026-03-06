import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { query, queryOne } from '../db/pool';
import { Order, CreateOrderDTO, OrderItem } from '../models/order';
import { publishOrderCreated, publishOrderStatusUpdate, publishOrderCancelled, publishInventoryReserve } from '../producers/orderProducer';

const itemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  sku: Joi.string().required(),
  name: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unit_price: Joi.number().min(0).required(),
});

const addressSchema = Joi.object({
  line1: Joi.string().required(),
  line2: Joi.string().optional(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  postal_code: Joi.string().required(),
  country: Joi.string().length(2).required(),
});

const createSchema = Joi.object({
  customer_id: Joi.string().uuid().required(),
  items: Joi.array().items(itemSchema).min(1).required(),
  shipping_address: addressSchema.required(),
  notes: Joi.string().max(1000).optional(),
  tax: Joi.number().min(0).default(0),
  shipping: Joi.number().min(0).default(0),
});

export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { customer_id, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (customer_id) { conditions.push(`customer_id = $${idx++}`); params.push(customer_id); }
    if (status)      { conditions.push(`status = $${idx++}`);       params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitNum = parseInt(limit, 10);
    const offset = (parseInt(page, 10) - 1) * limitNum;
    params.push(limitNum, offset);

    const orders = await query<Order>(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, params);
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) FROM orders ${where}`, params.slice(0, -2));

    res.json({ orders, total: parseInt(countResult[0].count, 10), page: parseInt(page, 10), limit: limitNum });
  } catch (err) { next(err); }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await queryOne<Order>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const events = await query('SELECT * FROM order_events WHERE order_id = $1 ORDER BY processed_at DESC', [req.params.id]);
    res.json({ ...order, events });
  } catch (err) { next(err); }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const dto = value as CreateOrderDTO & { tax: number; shipping: number };
    const items: OrderItem[] = dto.items.map((item: any) => ({ ...item, total: item.quantity * item.unit_price }));
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const total = subtotal + dto.tax + dto.shipping;

    const order = await queryOne<Order>(
      `INSERT INTO orders (customer_id, items, subtotal, tax, shipping, total, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dto.customer_id, JSON.stringify(items), subtotal, dto.tax, dto.shipping, total, JSON.stringify(dto.shipping_address), dto.notes ?? null]
    );

    await publishOrderCreated(order!);
    await publishInventoryReserve(order!.id, items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })));

    res.status(201).json(order);
  } catch (err) { next(err); }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];
    const { status } = req.body as { status: string };

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await queryOne<Order>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const order = await queryOne<Order>(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    await publishOrderStatusUpdate(req.params.id, existing.status, status);
    res.json(order);
  } catch (err) { next(err); }
}

export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as { reason?: string };
    const existing = await queryOne<Order>('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    if (['delivered', 'cancelled', 'refunded'].includes(existing.status)) {
      return res.status(409).json({ error: `Cannot cancel an order with status: ${existing.status}` });
    }

    const order = await queryOne<Order>(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await publishOrderCancelled(req.params.id, reason || 'User requested cancellation');
    res.json(order);
  } catch (err) { next(err); }
}
