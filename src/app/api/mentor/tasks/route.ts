import { NextResponse } from 'next/server';
import { getTasksByMentor, createTask, completeTask, createTasksBulk, deleteTask, editTask } from '@/lib/sheets/mentor-tasks';
import { getAutoTasksForMentor } from '@/lib/sheets/auto-tasks';
import { requireRole } from '@/lib/auth/helpers';
import { logEvent } from '@/lib/sheets/analytics-events';
import type { MentorTask } from '@/types';
import { z } from 'zod';

const CreateTaskSchema = z.object({
  student_id: z.string().min(1).optional(),
  student_name: z.string().min(1).optional(),
  task_type: z.enum(['follow_up', 'schedule_interview', 'review_progress', 'risk_check', 'update_student_data', 'other']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  source: z.enum(['auto', 'manual']).optional().default('manual'),
});

const ToggleTaskSchema = z.object({
  id: z.string().min(1),
  completed: z.boolean(),
});

const EditTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  task_type: z.enum(['follow_up', 'schedule_interview', 'review_progress', 'risk_check', 'update_student_data', 'other']).optional(),
});

const BulkAssignSchema = z.object({
  student_ids: z.array(z.string().min(1)).min(1),
  student_name_map: z.record(z.string(), z.string()).optional(),
  task_type: z.enum(['follow_up', 'schedule_interview', 'review_progress', 'risk_check', 'update_student_data', 'other']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
});

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);

    const [storedTasks, autoTasks] = await Promise.all([
      getTasksByMentor(user.email),
      getAutoTasksForMentor(user.email),
    ]);

    const allTasks = [...storedTasks];
    for (const auto of autoTasks) {
      const exists = storedTasks.some(
        t => !t.completed && t.student_id === auto.student_id && t.task_type === auto.task_type
      );
      if (!exists) {
        allTasks.push({ ...auto, id: `auto-${auto.student_id}-${auto.task_type}`, mentor_email: user.email } as MentorTask);
      }
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const studentId = searchParams.get('student_id');

    let filtered = allTasks;
    if (studentId) {
      filtered = filtered.filter(t => t.student_id === studentId);
    }
    if (filter === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (filter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    return NextResponse.json({ data: filtered, total: filtered.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);

    const body = await request.json();
    const result = CreateTaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const task = await createTask({
      ...result.data,
      mentor_email: user.email,
      student_id: result.data.student_id || '',
      student_name: result.data.student_name || '',
    });

    if (result.data.student_id) {
      await logEvent(
        'task_created',
        user.email,
        'mentor',
        result.data.student_id,
        result.data.student_name || '',
        { task_id: task.id, task_type: result.data.task_type, priority: result.data.priority }
      );
    }
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);

    const body = await request.json();

    // Check if this is a toggle (has completed) or an edit (has title/due_date/priority)
    const toggleResult = ToggleTaskSchema.safeParse(body);
    if (toggleResult.success && 'completed' in body && !('title' in body) && !('due_date' in body)) {
      const updated = await completeTask(toggleResult.data.id, toggleResult.data.completed);
      if (!updated) {
        return NextResponse.json({ message: 'Task not found' }, { status: 404 });
      }
      if (toggleResult.data.completed && updated.student_id) {
        await logEvent(
          'task_completed',
          user.email,
          'mentor',
          updated.student_id,
          updated.student_name || '',
          { task_id: updated.id, task_type: updated.task_type }
        );
      }
      return NextResponse.json({ data: updated });
    }

    const editResult = EditTaskSchema.safeParse(body);
    if (editResult.success) {
      const updated = await editTask(editResult.data.id, {
        title: editResult.data.title,
        description: editResult.data.description,
        due_date: editResult.data.due_date,
        priority: editResult.data.priority,
        task_type: editResult.data.task_type,
      });

      if (!updated) {
        return NextResponse.json({ message: 'Task not found' }, { status: 404 });
      }

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json(
      { message: 'Validation failed', errors: { body: 'Expected toggle or edit fields' } },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request.headers, ['mentor']);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'Task ID required' }, { status: 400 });
    }

    await deleteTask(id);
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);

    const body = await request.json();
    const result = BulkAssignSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { student_ids, student_name_map, task_type, title, description, due_date, priority } = result.data;

    const tasksToCreate = student_ids.map(studentId => ({
      mentor_email: user.email,
      student_id: studentId,
      student_name: student_name_map?.[studentId] ?? '',
      task_type,
      title,
      description: description ?? '',
      due_date,
      priority: priority ?? 'medium',
      source: 'manual' as const,
    }));

    const created = await createTasksBulk(tasksToCreate);
    for (const task of created) {
      await logEvent(
        'task_created',
        user.email,
        'mentor',
        task.student_id ?? '',
        task.student_name ?? '',
        { task_id: task.id, task_type: task.task_type, priority: task.priority, bulk: true }
      );
    }
    return NextResponse.json({ data: created, total: created.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
