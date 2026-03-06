import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import emailRoutes from './routes/emailRoutes';
import reportRoutes from './routes/reportRoutes';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from '../db/migrate';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-platform-api', timestamp: new Date().toISOString() });
});

app.use('/api/email-jobs', emailRoutes);
app.use('/api/report-jobs', reportRoutes);
app.use(errorHandler);

async function bootstrap() {
  await runMigrations();
  app.listen(PORT, () => {
    process.stdout.write(`API server running on port ${PORT}\n`);
  });
}

bootstrap().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
