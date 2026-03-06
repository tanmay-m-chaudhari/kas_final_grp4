import { CompressionTypes } from 'kafkajs';
import { getProducer, TOPICS } from './kafkaClient';
import { Order, CreateOrderDTO } from '../models/order';

export async function publishOrderCreated(order: Order): Promise<void> {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.ORDER_CREATED,
    compression: CompressionTypes.GZIP,
    messages: [
      {
        key: order.id,
        value: JSON.stringify({
          event_type: 'order.created',
          timestamp: new Date().toISOString(),
          data: order,
        }),
        headers: {
          'content-type': 'application/json',
          'event-version': '1.0',
        },
      },
    ],
  });
}

export async function publishOrderStatusUpdate(orderId: string, previousStatus: string, newStatus: string, metadata: Record<string, any> = {}): Promise<void> {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.ORDER_UPDATED,
    messages: [
      {
        key: orderId,
        value: JSON.stringify({
          event_type: 'order.status_updated',
          timestamp: new Date().toISOString(),
          data: { order_id: orderId, previous_status: previousStatus, new_status: newStatus, ...metadata },
        }),
      },
    ],
  });
}

export async function publishOrderCancelled(orderId: string, reason: string): Promise<void> {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.ORDER_CANCELLED,
    messages: [
      {
        key: orderId,
        value: JSON.stringify({
          event_type: 'order.cancelled',
          timestamp: new Date().toISOString(),
          data: { order_id: orderId, reason },
        }),
      },
    ],
  });
}

export async function publishInventoryReserve(orderId: string, items: { product_id: string; quantity: number }[]): Promise<void> {
  const producer = await getProducer();
  await producer.send({
    topic: TOPICS.INVENTORY_RESERVE,
    messages: [
      {
        key: orderId,
        value: JSON.stringify({
          event_type: 'inventory.reserve',
          timestamp: new Date().toISOString(),
          data: { order_id: orderId, items },
        }),
      },
    ],
  });
}
