import { Consumer, EachMessagePayload } from 'kafkajs';
import { kafka, TOPICS } from '../producers/kafkaClient';
import { query } from '../db/pool';

let consumer: Consumer | null = null;

export async function startOrderConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || 'order-consumers',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();

  await consumer.subscribe({
    topics: [TOPICS.ORDER_CREATED, TOPICS.ORDER_UPDATED, TOPICS.ORDER_CANCELLED],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const offset = `${partition}:${message.offset}`;

      await query(
        `INSERT INTO order_events (order_id, event_type, payload, partition_offset) VALUES ($1,$2,$3,$4)`,
        [event.data.id || event.data.order_id, event.event_type, JSON.stringify(event.data), offset]
      );

      if (topic === TOPICS.ORDER_CREATED) {
        await handleOrderCreated(event.data);
      } else if (topic === TOPICS.ORDER_UPDATED) {
        await handleOrderUpdated(event.data);
      } else if (topic === TOPICS.ORDER_CANCELLED) {
        await handleOrderCancelled(event.data);
      }
    },
  });
}

async function handleOrderCreated(data: any): Promise<void> {
  await query(
    `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
    [data.id]
  );
}

async function handleOrderUpdated(data: any): Promise<void> {
  await query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
    [data.new_status, data.order_id]
  );
}

async function handleOrderCancelled(data: any): Promise<void> {
  await query(
    `UPDATE orders SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || $1, updated_at = NOW() WHERE id = $2`,
    [`Cancelled: ${data.reason}`, data.order_id]
  );
}

export async function stopOrderConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
