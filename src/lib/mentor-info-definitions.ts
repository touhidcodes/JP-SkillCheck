/**
 * Context-aware information definitions for mentor dashboard.
 * Each definition includes title, description, metrics, calculation, and importance.
 * Used by InfoCard component to display mentor-friendly explanations.
 */

export const mentorInfoDefinitions = {
  // ─── Main Dashboard Stats Cards ───────────────────────────────────────────

  totalMentees: {
    title: 'Total Mentees',
    description: 'The complete count of students currently assigned to you. This represents your total workload and mentoring responsibility.',
    metrics: 'All active students in your mentor profile (not terminated or deleted)',
    calculation: 'COUNT(students WHERE mentor_email = your_email AND terminated = false)',
    importance: 'Helps you understand your workload and plan time allocation. Compare against your capacity to ensure quality mentoring.',
  },

  hiredThisMonth: {
    title: 'Hired This Month',
    description: 'The number of your students who secured job offers this month. This is your primary success metric.',
    metrics: 'Students with stage = "hired" AND updated_at >= current_month_start',
    calculation: 'COUNT(students WHERE stage = "hired" AND updated_at >= month_start)',
    importance: 'Directly measures your placement effectiveness. Track this weekly to identify trends and celebrate wins with your team.',
  },

  highRiskStudents: {
    title: 'High Risk Students',
    description: 'Students flagged as "high risk" based on attendance, inactivity, and job search progress. These need immediate intervention.',
    metrics: 'Risk scores calculated from: attendance rate, days since last activity, stage stagnation, interview progress, assignment completion',
    calculation: 'COUNT(riskScores WHERE level = "high") — Score > 50 = High Risk',
    importance: 'Identifies students at risk of dropping out or failing to secure placement. Prioritize these for check-ins and support.',
  },

  avgAttendance: {
    title: 'Average Attendance',
    description: 'The percentage of sessions your students attended. High attendance correlates with better placement outcomes.',
    metrics: 'All attendance logs for your students in the last 30 days',
    calculation: '(Total Present Sessions / Total Logged Sessions) × 100',
    importance: 'Low attendance is a leading indicator of risk. Students with <75% attendance need engagement strategies.',
  },

  activeThisWeek: {
    title: 'Active This Week',
    description: 'Students who logged progress or activity in the last 7 days. Shows current engagement level.',
    metrics: 'Students with last_activity_date >= 7 days ago (includes progress logs, attendance, stage changes)',
    calculation: 'COUNT(students WHERE last_activity_date > NOW() - 7 days)',
    importance: 'Inactive students are at higher risk. Use this to identify who needs a check-in call or task assignment.',
  },

  // ─── Charts & Visualizations ──────────────────────────────────────────────

  stageDistribution: {
    title: 'Pipeline Stage Distribution',
    description: 'Shows how many students are in each stage of the hiring pipeline. Identifies bottlenecks and progress.',
    metrics: 'Student count per stage: Learning → Applying → Interviewing → Offer Pending → Placed → Hired',
    calculation: 'COUNT(students) GROUP BY stage',
    importance: 'Reveals where students are getting stuck. Large groups in "Applying" or "Interviewing" may need interview prep or CV help.',
  },

  attendanceTrend: {
    title: 'Attendance Trend',
    description: 'Historical view of attendance rates over the last 8 sessions. Shows if engagement is improving or declining.',
    metrics: 'Attendance logs grouped by session date, calculated as (Present / Total) per session',
    calculation: 'For each session: (Count Present) / (Count Total Logged) × 100',
    importance: 'Downward trends signal disengagement. Upward trends show your interventions are working. Use to adjust support strategies.',
  },

  riskOverTime: {
    title: 'Risk Distribution Over Time',
    description: 'Weekly breakdown of how many students are in each risk level (Safe, Medium, High). Shows risk trajectory.',
    metrics: 'Risk scores recalculated weekly, grouped by risk level (Safe: 0-25, Medium: 26-50, High: 51-100)',
    calculation: 'For each week: COUNT(students) GROUP BY risk_level',
    importance: 'Increasing high-risk count means your interventions need adjustment. Decreasing count shows progress.',
  },

  batchPerformance: {
    title: 'Batch Performance',
    description: 'Placement rate and student count by batch/cohort. Compare performance across different groups.',
    metrics: 'Students grouped by batch, with placement rate = (Placed + Hired) / Total × 100',
    calculation: 'For each batch: (COUNT(stage IN [placed, hired]) / COUNT(total)) × 100',
    importance: 'Identifies which batches need more support. Batches with <30% placement rate need curriculum or mentoring review.',
  },

  activityTrends: {
    title: 'Activity Trends',
    description: 'Last 7 days of student engagement: progress logs created and interviews conducted. Shows mentee momentum.',
    metrics: 'Progress logs (all types) and interview logs, grouped by date',
    calculation: 'For each day: COUNT(progress_logs) + COUNT(interview_logs)',
    importance: 'Spikes show high engagement periods. Dips may indicate holidays or disengagement. Use to time interventions.',
  },

  pipelineStatus: {
    title: 'Pipeline Status',
    description: 'Overall distribution of students across the 5 active pipeline stages (not including hired). Shows pipeline health.',
    metrics: 'Student count in: Learning, Applying, Interviewing, Offer Pending, Placed',
    calculation: 'COUNT(students) WHERE stage IN [learning, applying, interviewing, offer_pending, placed]',
    importance: 'Healthy pipeline has students spread across stages. Bottlenecks (e.g., 50% in "Applying") need targeted help.',
  },

  // ─── Risk Tracker Page ────────────────────────────────────────────────────

  highRiskCount: {
    title: 'High Risk Count',
    description: 'Number of students with risk score > 50. These students need immediate attention and support.',
    metrics: 'Risk scores calculated from 6 factors: attendance, inactivity, stage stagnation, interview progress, assignment completion, communication gap',
    calculation: 'COUNT(riskScores WHERE score > 50)',
    importance: 'Each high-risk student represents a potential placement failure. Prioritize these for weekly check-ins.',
  },

  mediumRiskCount: {
    title: 'Medium Risk Count',
    description: 'Students with risk score 26-50. These are at moderate risk and need monitoring and proactive support.',
    metrics: 'Risk scores in the 26-50 range',
    calculation: 'COUNT(riskScores WHERE 26 <= score <= 50)',
    importance: 'Medium-risk students can be moved to safe with timely intervention. Use this as your "watch list".',
  },

  safeCount: {
    title: 'Safe Count',
    description: 'Students with risk score 0-25. These students are on track and need regular check-ins but no urgent intervention.',
    metrics: 'Risk scores 0-25 (good attendance, recent activity, stage progress)',
    calculation: 'COUNT(riskScores WHERE score <= 25)',
    importance: 'Maintain these students\' momentum with regular progress tracking and encouragement.',
  },

  riskTrend: {
    title: 'Risk Trend Over 8 Weeks',
    description: 'Historical view of risk distribution. Shows if your interventions are reducing high-risk count.',
    metrics: 'Weekly aggregation of risk levels (Safe, Medium, High)',
    calculation: 'For each week: COUNT(students) GROUP BY risk_level',
    importance: 'Downward trend in high-risk count validates your intervention strategy. Upward trend means you need to adjust.',
  },

  // ─── Leaderboard Page ─────────────────────────────────────────────────────

  leaderboardScore: {
    title: 'Student Performance Score',
    description: 'Composite score (0-100) based on activity, progress, and placement outcomes. Higher is better.',
    metrics: 'Calculated from: jobs applied, interviews conducted, tasks completed, offers received, stage progression',
    calculation: 'Score = (Jobs×10 + Interviews×15 + Tasks×5 + Offers×20 + Stage_Progress×50) / max_possible',
    importance: 'Use to identify top performers to celebrate and struggling students who need support. Motivates healthy competition.',
  },

  studentActivityTier: {
    title: 'Activity Tier',
    description: 'Classification of student engagement level: Excellent, Good, Moderate, Inactive, or Critical.',
    metrics: 'Based on: attendance rate (40%), days since last activity (30%), progress log frequency (30%)',
    calculation: 'Excellent: >90% attendance + activity <3 days | Good: >75% + <7 days | Moderate: >60% + <14 days | Inactive: <60% or >14 days | Critical: <40% or >30 days',
    importance: 'Quick visual indicator of engagement. Inactive/Critical students need immediate outreach.',
  },

  // ─── Student Detail View ──────────────────────────────────────────────────

  studentRiskScore: {
    title: 'Individual Risk Score',
    description: 'Personalized risk assessment for this student. Combines 6 risk factors into a single score.',
    metrics: 'Attendance (0-25), Inactivity (0-20), Stage Stagnation (0-20), Interview Progress (0-15), Assignment Completion (0-10), Communication Gap (0-10)',
    calculation: 'Sum of all factors, capped at 100. Score > 50 = High Risk, 26-50 = Medium, 0-25 = Safe',
    importance: 'Understand why a student is flagged as at-risk. Use the top factor to prioritize your intervention.',
  },

  studentAttendanceRate: {
    title: 'Student Attendance Rate',
    description: 'Percentage of sessions this student attended. Attendance is a leading indicator of placement success.',
    metrics: 'All attendance logs for this student',
    calculation: '(Sessions Present) / (Total Sessions Logged) × 100',
    importance: 'Students with <75% attendance are 3x more likely to fail placement. Investigate absences and create attendance plan.',
  },

  studentInterviewCount: {
    title: 'Interview Count',
    description: 'Total number of interviews this student has completed. More interviews = more placement chances.',
    metrics: 'Progress logs with type = "Interview Call"',
    calculation: 'COUNT(progress_logs WHERE log_type = "Interview Call")',
    importance: 'Students in "Applying" stage should have 1+ interview per week. Low count means CV/interview prep needed.',
  },

  studentJobsApplied: {
    title: 'Jobs Applied',
    description: 'Total number of job applications submitted. Shows job search activity level.',
    metrics: 'Progress logs with type = "Job Applied"',
    calculation: 'COUNT(progress_logs WHERE log_type = "Job Applied")',
    importance: 'Students should apply to 3-5 jobs per week. Low count means job search strategy needs review.',
  },

  studentDaysInStage: {
    title: 'Days in Current Stage',
    description: 'How long this student has been in their current pipeline stage. Identifies stagnation.',
    metrics: 'Current stage and date of last stage change',
    calculation: 'TODAY() - stage_change_date',
    importance: 'Students in "Applying" >30 days need interview prep. Students in "Interviewing" >45 days need offer negotiation help.',
  },

  studentLastActivity: {
    title: 'Last Activity',
    description: 'When this student last logged progress or had attendance recorded. Shows recent engagement.',
    metrics: 'Most recent timestamp from: progress logs, attendance logs, or stage changes',
    calculation: 'MAX(progress_log.created_at, attendance_log.date, student.updated_at)',
    importance: 'Students inactive >7 days need check-in. >14 days = high risk. >30 days = critical.',
  },

  // ─── Attendance Page ──────────────────────────────────────────────────────

  attendanceHeatmap: {
    title: 'Attendance Heatmap',
    description: '90-day calendar view of attendance. Green = Present, Red = Absent, Yellow = Excused, Gray = No Session.',
    metrics: 'All attendance logs for the selected student in the last 90 days',
    calculation: 'For each date: status = "present" | "absent" | "excused" | "no_session"',
    importance: 'Visual patterns show if absences are random or clustered. Clustered absences indicate specific issues to address.',
  },

  // ─── Progress Logs Page ───────────────────────────────────────────────────

  progressLogTimeline: {
    title: 'Progress Log Timeline',
    description: 'Chronological record of all student activities: interviews, job applications, offers, mock interviews, tasks.',
    metrics: 'All progress logs for the student, sorted by date',
    calculation: 'SELECT * FROM progress_logs WHERE student_id = ? ORDER BY scheduled_date DESC',
    importance: 'Tells the story of student progress. Use to identify patterns (e.g., interviews always on Tuesdays) and celebrate milestones.',
  },

  // ─── Placement Kanban Board ───────────────────────────────────────────────

  kanbanStageColumn: {
    title: 'Pipeline Stage Column',
    description: 'Drag-and-drop column showing all students in this stage. Update student stage by dragging cards.',
    metrics: 'Students filtered by current stage',
    calculation: 'COUNT(students) WHERE stage = column_stage',
    importance: 'Visual pipeline management. Drag cards to update stage when students progress. Helps track pipeline flow.',
  },

  // ─── Tasks Page ───────────────────────────────────────────────────────────

  taskPriority: {
    title: 'Task Priority',
    description: 'Urgency level of the task: Low, Medium, High, or Critical. Helps prioritize your daily work.',
    metrics: 'Manual priority assignment when creating task',
    calculation: 'User-selected: Low | Medium | High | Critical',
    importance: 'Focus on High/Critical tasks first. Use to manage your time and ensure urgent student needs are addressed.',
  },

  taskDueDate: {
    title: 'Task Due Date',
    description: 'When the task should be completed. Overdue tasks are highlighted in red.',
    metrics: 'Task due_date field',
    calculation: 'User-set date when creating task',
    importance: 'Overdue tasks indicate students needing immediate attention. Complete high-priority overdue tasks first.',
  },

  taskCompletion: {
    title: 'Task Completion',
    description: 'Whether the task has been marked complete. Completed tasks are archived and removed from active list.',
    metrics: 'Task completed flag and completed_at timestamp',
    calculation: 'completed = true | false',
    importance: 'Completing tasks ensures follow-ups happen. Use to track your mentoring consistency and student support.',
  },
};

export type MentorInfoKey = keyof typeof mentorInfoDefinitions;

export function getMentorInfo(key: MentorInfoKey) {
  return mentorInfoDefinitions[key];
}
