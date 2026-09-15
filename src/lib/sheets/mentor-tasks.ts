import { readSheet, appendRow, updateRow, findRowIndex } from './client';
import type { MentorTask, TaskPriority, MentorTaskType } from '@/types';
import { v4 as uuidv4 } from 'uuid';


function rowToTask(row: string[]): MentorTask {
  return {
    id: row[0] || '',
    mentor_email: row[1] || '',
    student_id: row[2] || undefined,
    student_name: row[3] || undefined,
    task_type: (row[4] as MentorTaskType) || 'other',
    title: row[5] || '',
    description: row[6] || '',
    due_date: row[7] || '',
    completed: row[8] === 'true',
    completed_at: row[9] || '',
    created_at: row[10] || '',
    priority: (row[11] as TaskPriority) || 'medium',
    source: (row[12] as 'auto' | 'manual') || 'manual',
  };
}

function taskToRow(task: Partial<MentorTask>): unknown[] {
  return [
    task.id || '',
    task.mentor_email || '',
    task.student_id || '',
    task.student_name || '',
    task.task_type || 'other',
    task.title || '',
    task.description || '',
    task.due_date || '',
    task.completed ? 'true' : 'false',
    task.completed_at || '',
    task.created_at || '',
    task.priority || 'medium',
    task.source || 'manual',
  ];
}

export async function getTasksByMentor(mentorEmail: string): Promise<MentorTask[]> {
  const rows = await readSheet('mentor_tasks');
  return rows
    .map(rowToTask)
    .filter(t => t.mentor_email === mentorEmail)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
}

export async function createTask(
  data: Pick<MentorTask, 'mentor_email' | 'student_id' | 'student_name' | 'task_type' | 'title' | 'description' | 'due_date' | 'priority'> & {
    source?: MentorTask['source'];
  }
): Promise<MentorTask> {
  const now = new Date().toISOString();
  const task: MentorTask = {
    id: uuidv4(),
    mentor_email: data.mentor_email,
    student_id: data.student_id,
    student_name: data.student_name,
    task_type: data.task_type,
    title: data.title,
    description: data.description,
    due_date: data.due_date,
    priority: data.priority,
    completed: false,
    completed_at: '',
    created_at: now,
    source: data.source || 'manual',
  };
  await appendRow('mentor_tasks', taskToRow(task));
  return task;
}

export async function completeTask(id: string, completed: boolean): Promise<MentorTask | null> {
  const rowIndex = await findRowIndex('mentor_tasks', 0, id);
  if (rowIndex === -1) return null;

  const rows = await readSheet('mentor_tasks');
  const existing = rowToTask(rows[rowIndex - 1]);

  const updated: MentorTask = {
    ...existing,
    completed,
    completed_at: completed ? new Date().toISOString() : '',
  };
  await updateRow('mentor_tasks', rowIndex, taskToRow(updated));
  return updated;
}

export async function editTask(
  id: string,
  fields: Partial<Pick<MentorTask, 'title' | 'description' | 'due_date' | 'priority' | 'task_type'>>
): Promise<MentorTask | null> {
  const rowIndex = await findRowIndex('mentor_tasks', 0, id);
  if (rowIndex === -1) return null;

  const rows = await readSheet('mentor_tasks');
  const existing = rowToTask(rows[rowIndex - 1]);

  const updated: MentorTask = {
    ...existing,
    ...fields,
  };
  await updateRow('mentor_tasks', rowIndex, taskToRow(updated));
  return updated;
}

export async function deleteTask(id: string): Promise<void> {
  const rowIndex = await findRowIndex('mentor_tasks', 0, id);
  if (rowIndex === -1) return;
  const { deleteRow } = await import('./client');
  await deleteRow('mentor_tasks', rowIndex);
}

/**
 * Bulk-create mentor tasks in a single sheet write operation.
 * Used by the bulk-assign API to create many tasks at once.
 */
export async function createTasksBulk(
  tasks: Array<Pick<MentorTask, 'mentor_email' | 'student_id' | 'student_name' | 'task_type' | 'title' | 'description' | 'due_date' | 'priority'> & { source?: MentorTask['source'] }>
): Promise<MentorTask[]> {
  const now = new Date().toISOString();
  const created: MentorTask[] = tasks.map(data => ({
    id: uuidv4(),
    mentor_email: data.mentor_email,
    student_id: data.student_id,
    student_name: data.student_name,
    task_type: data.task_type,
    title: data.title,
    description: data.description,
    due_date: data.due_date,
    priority: data.priority,
    completed: false,
    completed_at: '',
    created_at: now,
    source: data.source || 'manual',
  }));

  const rows = created.map(taskToRow);
  for (const row of rows) {
    await appendRow('mentor_tasks', row);
  }
  return created;
}