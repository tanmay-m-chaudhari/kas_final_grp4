import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../../db/pool';
import { emailQueue } from '../../services/queueService';
import { CreateEmailJobDTO, EmailJob } from '../../models/emailJob';

const router = Router();

const schema = Joi.object({
  recipient_email: Joi.string().email().required(),
  subject: Joi.string().min(1).max(200).required(),
  template: Joi.string().valid('welcome', 'password_reset', 'invoice', 'alert').required(),
  payload: Joi.object().required(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const dto = value as CreateEmailJobDTO;
    const job = await queryOne<EmailJob>(
      `INSERT INTO email_jobs (recipient_email, subject, template, payload) VALUES ($1,$2,$3,$4) RETURNING *`,
      [dto.recipient_email, dto.subject, dto.template, JSON.stringify(dto.payload)]
    );

    await emailQueue.add('send-email', { emailJobId: job!.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.status(202).json({ job_id: job!.id, status: 'queued' });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await queryOne<EmailJob>('SELECT * FROM email_jobs WHERE id = $1', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Email job not found' });
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await query<EmailJob>('SELECT * FROM email_jobs ORDER BY created_at DESC LIMIT 50');
    res.json(jobs);
  } catch (err) { next(err); }
});

export default router;
