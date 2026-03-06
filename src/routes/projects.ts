import { Router } from 'express';
import { listProjects, getProject, createProject, deleteProject } from '../controllers/projectController';

const router = Router();
router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.delete('/:id', deleteProject);
export default router;
