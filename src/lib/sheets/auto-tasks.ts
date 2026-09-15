import { getAllStudents } from './students';
import { getAllProgressLogs } from './progress-logs';
import type { MentorTask } from '@/types';
import { differenceInDays, subDays, format, addDays } from 'date-fns';

function isAtRisk(student: { risk_status: string; last_activity_date: string; terminated: boolean; hired: boolean }): boolean {
  if (student.terminated || student.hired) return false;
  if (student.risk_status === 'at_risk') return true;
  if (!student.last_activity_date) return false;
  try {
    return differenceInDays(new Date(), new Date(student.last_activity_date)) >= 7;
  } catch {
    return false;
  }
}

export type AutoTask = Omit<MentorTask, 'id' | 'completed' | 'completed_at' | 'created_at' | 'mentor_email'> & {
  source: 'auto';
};

export function generateAutoTasksForStudent(student: {
  id: string;
  name: string;
  last_activity_date: string;
  stage: string;
  risk_status: string;
  terminated: boolean;
  hired: boolean;
}): AutoTask[] {
  const tasks: AutoTask[] = [];
  const now = new Date();
  const dueDate = format(addDays(now, 3), 'yyyy-MM-dd');

  if (isAtRisk(student)) {
    tasks.push({
      student_id: student.id,
      student_name: student.name,
      task_type: 'follow_up',
      title: `Follow up with ${student.name} — at risk`,
      description: 'This student has been flagged as at-risk. Reach out to understand their situation and help resolve blockers.',
      due_date: dueDate,
      priority: 'critical',
      source: 'auto',
    });
  }

  if (!student.last_activity_date) {
    tasks.push({
      student_id: student.id,
      student_name: student.name,
      task_type: 'update_student_data',
      title: `Update progress for ${student.name}`,
      description: 'No recent activity recorded. Log an update to reflect their current status.',
      due_date: dueDate,
      priority: 'medium',
      source: 'auto',
    });
  } else {
    try {
      const daysSinceActivity = differenceInDays(now, new Date(student.last_activity_date));
      if (daysSinceActivity >= 5) {
        tasks.push({
          student_id: student.id,
          student_name: student.name,
          task_type: 'review_progress',
          title: `Review progress for ${student.name}`,
          description: `Last activity was ${daysSinceActivity} days ago. Schedule a check-in or update their progress log.`,
          due_date: dueDate,
          priority: daysSinceActivity >= 10 ? 'high' : 'medium',
          source: 'auto',
        });
      }
    } catch {
      // ignore date parsing errors
    }
  }

  if (student.stage === 'offer_pending') {
    tasks.push({
      student_id: student.id,
      student_name: student.name,
      task_type: 'schedule_interview',
      title: `Confirm offer status with ${student.name}`,
      description: 'Student is in offer_pending stage. Follow up to confirm if they accepted the offer and update their status accordingly.',
      due_date: format(addDays(now, 1), 'yyyy-MM-dd'),
      priority: 'high',
      source: 'auto',
    });
  }

  if (student.stage === 'interviewing') {
    const weekFromNow = format(addDays(now, 7), 'yyyy-MM-dd');
    tasks.push({
      student_id: student.id,
      student_name: student.name,
      task_type: 'risk_check',
      title: `Interview follow-up for ${student.name}`,
      description: 'Student is in the interviewing stage. Check if they have any upcoming interviews scheduled or need support preparing.',
      due_date: weekFromNow,
      priority: 'medium',
      source: 'auto',
    });
  }

  return tasks;
}

export async function getAutoTasksForMentor(mentorEmail: string): Promise<AutoTask[]> {
  const [students, allLogs] = await Promise.all([
    getAllStudents(),
    getAllProgressLogs(),
  ]);

  const myStudents = students.filter(s => s.mentor_email === mentorEmail && !s.terminated && !s.hired);
  const weekAgo = subDays(new Date(), 7);

  const autoTasks: AutoTask[] = [];

  for (const student of myStudents) {
    const studentLogs = allLogs.filter(l => l.student_id === student.id);
    const logsThisWeek = studentLogs.filter(l => {
      try {
        return new Date(l.logged_at) >= weekAgo;
      } catch {
        return false;
      }
    });

    const recentActivity = student.last_activity_date
      ? new Date(student.last_activity_date) >= weekAgo
      : false;

    if (!recentActivity && logsThisWeek.length === 0) {
      autoTasks.push(...generateAutoTasksForStudent(student));
    } else {
      const generated = generateAutoTasksForStudent(student);
      for (const task of generated) {
        const hasSimilarTask = autoTasks.some(
          t => t.student_id === task.student_id &&
               t.task_type === task.task_type
        );
        if (!hasSimilarTask) {
          autoTasks.push(task);
        }
      }
    }
  }

  return autoTasks;
}