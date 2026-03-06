import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-delivery', { connection });
export const reportQueue = new Queue('report-generation', { connection });

export { connection };
