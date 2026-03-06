import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import taskRoutes from './routes/tasks';
import projectRoutes from './routes/projects';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from './db/migrate';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'task-management-api', timestamp: new Date().toISOString() });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use(errorHandler);

async function bootstrap() {
  await runMigrations();
  app.listen(PORT, () => {
    process.stdout.write(`Server started on port ${PORT}\n`);
  });
}

bootstrap().catch((err) => {
  process.stderr.write(err.message);
  process.exit(1);
});
