'use client';

import { ListTodo, CheckCircle2, Clock, Target } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';

interface TaskStatsProps {
  pendingCount: number;
  overdueCount: number;
  completionRate: number;
  totalMentees: number;
}

export function TaskStats({
  pendingCount,
  overdueCount,
  completionRate,
  totalMentees,
}: TaskStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Pending Tasks"
        value={pendingCount}
        subtitle="Active items"
        icon={ListTodo}
        color="indigo"
        info={{
          description: "Number of tasks currently assigned to your mentees that are not yet completed.",
          metrics: "Count of all tasks with status = 'pending' or 'in_progress'",
          calculation: "COUNT(tasks WHERE status IN ['pending', 'in_progress'])",
          importance: "Helps you track your mentoring workload and ensure no mentee falls through the cracks."
        }}
      />
      <StatsCard
        title="Completion"
        value={`${completionRate}%`}
        subtitle="Overall rate"
        icon={CheckCircle2}
        color="emerald"
        info={{
          description: "Percentage of assigned tasks that have been completed.",
          metrics: "Completed tasks vs total tasks assigned",
          calculation: "(COUNT(tasks WHERE status = 'completed') / COUNT(tasks)) × 100",
          importance: "High completion rate shows consistent mentoring follow-through and mentee engagement."
        }}
      />
      <StatsCard
        title="Overdue"
        value={overdueCount}
        subtitle={overdueCount > 0 ? 'Requires attention' : 'All on track'}
        icon={Clock}
        color="red"
        info={{
          description: "Number of tasks that have passed their due date without completion.",
          metrics: "Tasks where due_date < TODAY() and status != 'completed'",
          calculation: "COUNT(tasks WHERE due_date < NOW() AND status != 'completed')",
          importance: "Overdue tasks indicate mentees needing immediate follow-up or support to get back on track."
        }}
      />
      <StatsCard
        title="Mentees"
        value={totalMentees}
        subtitle="Active assignments"
        icon={Target}
        color="amber"
        info={{
          description: "Total number of mentees with active task assignments.",
          metrics: "Unique mentees with at least one pending or in-progress task",
          calculation: "COUNT(DISTINCT mentee_id WHERE task_status IN ['pending', 'in_progress'])",
          importance: "Shows how many mentees you're actively supporting with structured guidance and accountability."
        }}
      />
    </div>
  );
}
