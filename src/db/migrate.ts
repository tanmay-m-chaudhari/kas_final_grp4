import { query } from './pool';

export async function runMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
      items JSONB NOT NULL DEFAULT '[]',
      subtotal NUMERIC(10,2) NOT NULL,
      tax NUMERIC(10,2) NOT NULL DEFAULT 0,
      shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      shipping_address JSONB NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      partition_offset TEXT,
      processed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('reserved','released','confirmed','adjusted')),
      quantity_delta INTEGER NOT NULL,
      order_id UUID,
      payload JSONB NOT NULL DEFAULT '{}',
      processed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_inventory_events_product ON inventory_events(product_id)`);
}
