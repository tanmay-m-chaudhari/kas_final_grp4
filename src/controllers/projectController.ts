import { Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/pool';
import { Project } from '../models/task';
import Joi from 'joi';

const schema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  description: Joi.string().max(1000).optional(),
  owner_id: Joi.string().uuid().required(),
});

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const projects = await query<Project>('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) { next(err); }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await queryOne<Project>('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = await query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...project, tasks });
  } catch (err) { next(err); }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const project = await queryOne<Project>(
      `INSERT INTO projects (name, description, owner_id) VALUES ($1,$2,$3) RETURNING *`,
      [value.name, value.description ?? null, value.owner_id]
    );
    res.status(201).json(project);
  } catch (err) { next(err); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.status(204).send();
  } catch (err) { next(err); }
}
