export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  project_id: string;
  assignee_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskDTO {
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  project_id: string;
  assignee_id?: string;
  due_date?: string;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  assignee_id?: string;
  due_date?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}
