'use client';

import { Users, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';

interface StatsGridProps {
  total: number;
  totalMenteesSubtitle: string;
  hiredThisMonth: number;
  hiredPercentage: number;
  highRisk: number;
  highRiskSubtitle: string;
  avgAttendance: number;
  avgAttendanceSubtitle: string;
  activeThisWeek: number;
  inactiveCount: number;
}

function buildCardConfigs(props: StatsGridProps) {
  return [
    {
      title: "Total Mentees",
      value: props.total,
      subtitle: props.totalMenteesSubtitle,
      icon: Users,
      color: "purple" as const,
      info: {
        description: "Total number of students assigned to you.",
        metrics: "Count of all active, at-risk, and hired students assigned to your email.",
        calculation: "COUNT(students WHERE mentor_email = user_email)",
        importance: "Gives a baseline understanding of your total workload capacity."
      }
    },
    {
      title: "Hired This Month",
      value: props.hiredThisMonth,
      subtitle: `${props.hiredPercentage}% placement rate`,
      icon: CheckCircle2,
      color: "emerald" as const,
      info: {
        description: "Number of your mentees hired in the current month.",
        metrics: "Students transitioning to 'hired' stage within the last 30 days.",
        calculation: "COUNT(students WHERE stage = 'hired' AND updated_at > current_month_start)",
        importance: "Immediate measure of placement velocity and recent program success."
      }
    },
    {
      title: "High Risk Students",
      value: props.highRisk,
      subtitle: props.highRiskSubtitle,
      icon: AlertTriangle,
      color: "red" as const,
      info: {
        description: "Students identified as having a high risk of dropping out or failing to secure a job.",
        metrics: "Students currently flagged with 'high' risk tier.",
        calculation: "COUNT(students WHERE risk_status = 'at_risk')",
        importance: "These students require immediate intervention and 1-on-1 focus to prevent dropout."
      }
    },
    {
      title: "Avg Attendance",
      value: `${props.avgAttendance}%`,
      subtitle: props.avgAttendanceSubtitle,
      icon: ClipboardCheck,
      color: "amber" as const,
      info: {
        description: "Average attendance rate of your assigned mentees across all sessions.",
        metrics: "Aggregate attendance logs.",
        calculation: "AVERAGE(Total Present / Total Logged Sessions) * 100",
        importance: "Strongly correlates with mentee engagement and overall placement success."
      }
    },
    {
      title: "Active This Week",
      value: props.activeThisWeek,
      subtitle: `${props.inactiveCount} inactive`,
      icon: Users,
      color: "indigo" as const,
      info: {
        description: "Number of students who have actively progressed or engaged within the last 7 days.",
        metrics: "Recent activity timestamps (Attendance, Tasks, Logs).",
        calculation: "COUNT(students WHERE last_activity_date > 7_days_ago)",
        importance: "Shows immediate mentee engagement and potential stalled students."
      }
    }
  ];
}

export function MentorStatsGrid(props: StatsGridProps) {
  const cards = buildCardConfigs(props);
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <StatsCard key={card.title} {...card} />
      ))}
    </div>
  );
}
