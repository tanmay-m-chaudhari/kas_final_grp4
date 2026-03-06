import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { connection } from '../../services/queueService';
import { processEmailJob } from './emailProcessor';
import { query } from '../../db/pool';

const worker = new Worker(
  'email-delivery',
  async (job: Job) => {
    const { emailJobId } = job.data as { emailJobId: string };

    await query(`UPDATE email_jobs SET status = 'queued', attempts = attempts + 1 WHERE id = $1`, [emailJobId]);

    const result = await processEmailJob(emailJobId, job.data);

    await query(
      `UPDATE email_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1`,
      [emailJobId]
    );

    return result;
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 100, duration: 60000 },
  }
);

worker.on('failed', async (job: Job | undefined, err: Error) => {
  if (job) {
    await query(
      `UPDATE email_jobs SET status = 'failed', error = $1 WHERE id = $2`,
      [err.message, job.data.emailJobId]
    );
  }
});
