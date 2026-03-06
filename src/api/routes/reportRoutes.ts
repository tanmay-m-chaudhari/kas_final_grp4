import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { queryOne, query } from '../../db/pool';
import { reportQueue } from '../../services/queueService';
import { CreateReportJobDTO, ReportJob } from '../../models/reportJob';

const router = Router();

const schema = Joi.object({
  report_type: Joi.string().valid('user_activity', 'revenue_summary', 'system_health').required(),
  parameters: Joi.object().default({}),
  requested_by: Joi.string().uuid().optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const dto = value as CreateReportJobDTO;
    const job = await queryOne<ReportJob>(
      `INSERT INTO report_jobs (report_type, parameters, requested_by) VALUES ($1,$2,$3) RETURNING *`,
      [dto.report_type, JSON.stringify(dto.parameters), dto.requested_by ?? null]
    );

    await reportQueue.add('generate-report', { reportJobId: job!.id }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10000 },
    });

    res.status(202).json({ job_id: job!.id, status: 'queued' });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await queryOne<ReportJob>('SELECT * FROM report_jobs WHERE id = $1', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Report job not found' });
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await query<ReportJob>('SELECT * FROM report_jobs ORDER BY created_at DESC LIMIT 50');
    res.json(jobs);
  } catch (err) { next(err); }
});

export default router;
