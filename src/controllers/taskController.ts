import { Request, Response, NextFunction } from 'express';
import { query, queryOne, withTransaction } from '../db/pool';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '../models/task';
import Joi from 'joi';

const createSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('todo', 'in_progress', 'done', 'cancelled').default('todo'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  project_id: Joi.string().uuid().required(),
  assignee_id: Joi.string().uuid().optional(),
  due_date: Joi.string().isoDate().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('todo', 'in_progress', 'done', 'cancelled').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  assignee_id: Joi.string().uuid().allow(null).optional(),
  due_date: Joi.string().isoDate().allow(null).optional(),
}).min(1);

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { project_id, status, priority, assignee_id, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (project_id)  { conditions.push(`t.project_id = $${idx++}`);   params.push(project_id); }
    if (status)      { conditions.push(`t.status = $${idx++}`);        params.push(status); }
    if (priority)    { conditions.push(`t.priority = $${idx++}`);      params.push(priority); }
    if (assignee_id) { conditions.push(`t.assignee_id = $${idx++}`);   params.push(assignee_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const filterParams = [...params];
    params.push(parseInt(limit, 10), offset);

    const tasks = await query<Task>(
      `SELECT t.*, u.name AS assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id ${where} ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) FROM tasks t ${where}`, filterParams);

    res.json({ tasks, total: parseInt(countResult[0].count, 10), page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) { next(err); }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) { next(err); }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const dto = value as CreateTaskDTO;
    const task = await queryOne<Task>(
      `INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dto.title, dto.description ?? null, dto.status, dto.priority, dto.project_id, dto.assignee_id ?? null, dto.due_date ?? null]
    );
    res.status(201).json(task);
  } catch (err) { next(err); }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const dto = value as UpdateTaskDTO;
    const fields = Object.entries(dto).filter(([, v]) => v !== undefined);
    const sets = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const vals = fields.map(([, v]) => v);
    const task = await queryOne<Task>(
      `UPDATE tasks SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...vals]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) { next(err); }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    await withTransaction(async (client) => {
      const result = await client.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rowCount === 0) throw Object.assign(new Error('Task not found'), { statusCode: 404 });
    });
    res.status(204).send();
  } catch (err: any) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
}

export async function bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = Joi.object({
      ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      status: Joi.string().valid('todo', 'in_progress', 'done', 'cancelled').required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const { ids, status } = value;
    const placeholders = ids.map((_: any, i: number) => `$${i + 2}`).join(',');
    const tasks = await query<Task>(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING *`,
      [status, ...ids]
    );
    res.json({ updated: tasks.length, tasks });
  } catch (err) { next(err); }
}
