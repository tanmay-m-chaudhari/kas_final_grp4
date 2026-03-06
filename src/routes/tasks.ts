import { Router } from 'express';
import { listTasks, getTask, createTask, updateTask, deleteTask, bulkUpdateStatus } from '../controllers/taskController';

const router = Router();
router.get('/', listTasks);
router.get('/:id', getTask);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/bulk/status', bulkUpdateStatus);
export default router;
