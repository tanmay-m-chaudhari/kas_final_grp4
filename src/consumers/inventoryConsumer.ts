import { Consumer, EachMessagePayload } from 'kafkajs';
import { kafka, TOPICS } from '../producers/kafkaClient';
import { query } from '../db/pool';

let consumer: Consumer | null = null;

export async function startInventoryConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: `${process.env.KAFKA_GROUP_ID || 'order-consumers'}-inventory`,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumer.connect();

  await consumer.subscribe({
    topics: [TOPICS.INVENTORY_RESERVE, TOPICS.INVENTORY_RELEASE],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ partition, message }: EachMessagePayload) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString());

      if (event.event_type === 'inventory.reserve') {
        for (const item of event.data.items) {
          await query(
            `INSERT INTO inventory_events (product_id, event_type, quantity_delta, order_id, payload) VALUES ($1,'reserved',$2,$3,$4)`,
            [item.product_id, -item.quantity, event.data.order_id, JSON.stringify(item)]
          );
        }
      } else if (event.event_type === 'inventory.release') {
        for (const item of event.data.items) {
          await query(
            `INSERT INTO inventory_events (product_id, event_type, quantity_delta, order_id, payload) VALUES ($1,'released',$2,$3,$4)`,
            [item.product_id, item.quantity, event.data.order_id, JSON.stringify(item)]
          );
        }
      }
    },
  });
}

export async function stopInventoryConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
