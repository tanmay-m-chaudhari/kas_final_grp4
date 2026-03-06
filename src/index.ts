import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './db/connection';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'product-catalog-api', timestamp: new Date().toISOString() });
});

app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use(errorHandler);

async function bootstrap() {
  await connectDB();
  app.listen(PORT, () => {
    process.stdout.write(`Server running on port ${PORT}\n`);
  });
}

bootstrap().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
