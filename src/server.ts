import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import orderRoutes from './routes/orders';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from './db/migrate';
import { startOrderConsumer, stopOrderConsumer } from './consumers/orderConsumer';
import { startInventoryConsumer, stopInventoryConsumer } from './consumers/inventoryConsumer';
import { disconnectProducer } from './producers/kafkaClient';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'order-event-platform', timestamp: new Date().toISOString() });
});

app.use('/api/orders', orderRoutes);
app.use(errorHandler);

async function bootstrap() {
  await runMigrations();
  await startOrderConsumer();
  await startInventoryConsumer();

  const server = app.listen(PORT, () => {
    process.stdout.write(`Order event platform running on port ${PORT}\n`);
  });

  const shutdown = async () => {
    server.close();
    await stopOrderConsumer();
    await stopInventoryConsumer();
    await disconnectProducer();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
