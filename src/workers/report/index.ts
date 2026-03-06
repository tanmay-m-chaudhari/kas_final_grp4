import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { connection } from '../../services/queueService';
import { generateReport } from './reportGenerator';
import { query } from '../../db/pool';

const worker = new Worker(
  'report-generation',
  async (job: Job) => {
    const { reportJobId } = job.data as { reportJobId: string };

    await query(`UPDATE report_jobs SET status = 'processing' WHERE id = $1`, [reportJobId]);

    const outputPath = await generateReport(reportJobId, job.data);

    await query(
      `UPDATE report_jobs SET status = 'done', output_path = $1, completed_at = NOW() WHERE id = $2`,
      [outputPath, reportJobId]
    );

    return { outputPath };
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on('failed', async (job: Job | undefined, err: Error) => {
  if (job) {
    await query(
      `UPDATE report_jobs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2`,
      [err.message, job.data.reportJobId]
    );
  }
});
