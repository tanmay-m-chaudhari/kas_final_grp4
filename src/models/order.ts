export interface OrderItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: string;
  customer_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shipping_address: ShippingAddress;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderDTO {
  customer_id: string;
  items: Omit<OrderItem, 'total'>[];
  shipping_address: ShippingAddress;
  notes?: string;
  tax?: number;
  shipping?: number;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  payload: Record<string, any>;
  partition_offset?: string;
  processed_at: string;
}
