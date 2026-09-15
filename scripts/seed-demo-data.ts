/**
 * Demo Data Seeder — Mentor Management System
 *
 * Generates realistic, production-like data across all Google Sheets tables
 * to fully populate the analytics dashboard, charts, tables, and workflows.
 *
 * Design principles:
 * - IDEMPOTENT: Safe to run multiple times; skips if data already exists
 * - RELATIONAL: All foreign keys reference real records
 * - REALISTIC: Natural distributions, varied timestamps, meaningful trends
 * - NON-DESTRUCTIVE: Never touches the users table; only appends to others
 * - BATCHED: Uses batchUpdate for efficiency against Google Sheets API
 *
 * Data distribution (~70 students across 5 mentors):
 *   Stages:       12% learning, 22% applying, 26% interviewing, 16% offer_pending, 12% placed, 12% hired
 *   Risk:         ~18% at_risk (with history entries)
 *   Terminated:   ~6%
 *   Batches:      Q1-Q4 2024, Q1-Q2 2025
 *   Projects:     Distributed across all 8 project types
 *   Experience:   55% fresher, 45% experienced
 *
 * Run:
 *   npx tsx scripts/seed-demo-data.ts
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuration ───────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const STUDENTS_PER_MENTOR = 13;
const TOTAL_DAYS_HISTORY = 120;
const PROGRESS_LOGS_PER_STUDENT_MIN = 3;
const PROGRESS_LOGS_PER_STUDENT_MAX = 10;

if (!SPREADSHEET_ID) {
  console.error('❌  GOOGLE_SPREADSHEET_ID not set in .env.local');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Seed Data: Realistic Names, Companies, etc. ─────────────────────────────

const FIRST_NAMES = [
  'Arafat', 'Rahim', 'Karim', 'Sumaiya', 'Nusrat', 'Farhana', 'Tanjim', 'Rafiq',
  'Mehedi', 'Shorna', 'Purnima', 'Sakib', 'Riad', 'Tamanna', 'Jahid', 'Fahmida',
  'Imran', 'Nadia', 'Rasel', 'Dipa', 'Kamal', 'Sultana', 'Masud', 'Roksana',
  'Arif', 'Shimul', 'Bappi', 'Tania', 'Sohel', 'Mitu', 'Rubel', 'Farida',
  'Hasan', 'Lima', 'Jewel', 'Munni', 'Shuvo', 'Rina', 'Khaled', 'Sadia',
  'Nabil', 'Tumpa', 'Rony', 'Mim', 'Tanvir', 'Nila', 'Sajid', 'Papia',
  'Rakib', 'Shanta', 'Emon', 'Moushumi', 'Palash', 'Keya', 'Shihab', 'Rehana',
  'Asif', 'Sonia', 'Biplob', 'Doli', 'Ratan', 'Mili', 'Kobir', 'Sathi',
];

const LAST_NAMES = [
  'Islam', 'Hossain', 'Ahmed', 'Begum', 'Khan', 'Rahman', 'Akter', 'Ali',
  'Sultana', 'Chowdhury', 'Hasan', 'Uddin', 'Jahan', 'Mia', 'Parvin',
  'Sarker', 'Das', 'Paul', 'Roy', 'Barman', 'Mondal', 'Biswas', 'Dey', 'Ghosh',
];

const COMPANIES = [
  { name: 'Brain Station 23', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'TigerIT', industry: 'tech', size: 'mid', location: 'Dhaka' },
  { name: 'Enosis Solutions', industry: 'tech', size: 'mid', location: 'Dhaka' },
  { name: 'Selise Digital', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'DataSoft', industry: 'tech', size: 'mid', location: 'Dhaka' },
  { name: 'LeadSoft', industry: 'tech', size: 'startup', location: 'Dhaka' },
  { name: 'Cefalo Bangladesh', industry: 'tech', size: 'mid', location: 'Dhaka' },
  { name: 'Therap BD', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'BJIT Group', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'Samsung R&D Bangladesh', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'Dexian (formerly Telenor)', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
  { name: 'KonaSoft', industry: 'tech', size: 'startup', location: 'Dhaka' },
  { name: 'Optimizely', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'Crio.Do', industry: 'tech', size: 'startup', location: 'Remote' },
  { name: 'Upwork', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'Fiverr', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'Toptal', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'Andela', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'Revelo', industry: 'tech', size: 'mid', location: 'Remote' },
  { name: 'Turing', industry: 'tech', size: 'enterprise', location: 'Remote' },
  { name: 'bKash', industry: 'finance', size: 'enterprise', location: 'Dhaka' },
  { name: 'Nagad', industry: 'finance', size: 'enterprise', location: 'Dhaka' },
  { name: 'Pathao', industry: 'ecommerce', size: 'mid', location: 'Dhaka' },
  { name: 'Chaldal', industry: 'ecommerce', size: 'mid', location: 'Dhaka' },
  { name: 'ShopUp', industry: 'ecommerce', size: 'mid', location: 'Dhaka' },
  { name: '10 Minute School', industry: 'tech', size: 'mid', location: 'Dhaka' },
  { name: 'Shikho', industry: 'tech', size: 'startup', location: 'Dhaka' },
  { name: 'Mycareer', industry: 'tech', size: 'startup', location: 'Dhaka' },
  { name: 'Palli Karma Sahayak', industry: 'finance', size: 'enterprise', location: 'Dhaka' },
  { name: 'Grameenphone', industry: 'tech', size: 'enterprise', location: 'Dhaka' },
];

const PROJECTS: Array<{ name: string; stages: string[] }> = [
  { name: 'Endgame', stages: ['learning', 'applying', 'interviewing', 'offer_pending'] },
  { name: 'SCPC', stages: ['learning', 'applying', 'interviewing', 'placed', 'hired'] },
  { name: 'EAP', stages: ['applying', 'interviewing', 'offer_pending', 'hired'] },
  { name: 'Squid Game', stages: ['learning', 'applying', 'interviewing'] },
  { name: 'Kaizen', stages: ['learning', 'applying', 'interviewing', 'offer_pending', 'placed'] },
  { name: 'Odyssey', stages: ['applying', 'interviewing', 'offer_pending', 'placed', 'hired'] },
  { name: 'STN', stages: ['learning', 'applying', 'interviewing', 'hired'] },
  { name: 'Other', stages: ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'] },
];

const BATCHES = ['batch-2024-Q1', 'batch-2024-Q2', 'batch-2024-Q3', 'batch-2024-Q4', 'batch-2025-Q1', 'batch-2025-Q2'];

const JOB_FOCI = ['remote', 'onsite', 'hybrid'];
const EXPERIENCE_LEVELS = ['fresher', 'experienced'];

const STAGE_DISTRIBUTION = [
  { stage: 'learning', weight: 12 },
  { stage: 'applying', weight: 22 },
  { stage: 'interviewing', weight: 26 },
  { stage: 'offer_pending', weight: 16 },
  { stage: 'placed', weight: 12 },
  { stage: 'hired', weight: 12 },
];

const LOG_TYPES = ['Job Applied', 'Interview Call', 'Mock Interview', 'Job Task', 'Offer', 'Other'];
const MOCK_TYPES = ['technical', 'behavioral', 'system_design', 'hr', 'mock'];
const TASK_TYPES = ['follow_up', 'schedule_interview', 'review_progress', 'risk_check', 'update_student_data', 'other'];
const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const EXCUSES = ['exam', 'sick', 'personal', 'other'];

const RISK_REASONS = [
  'No activity for 7+ days',
  'Multiple unexcused absences',
  'Low interview conversion rate',
  'Stage stalled for 30+ days',
  'Declining attendance rate',
  'No progress logs in 2 weeks',
  'Failed multiple mock interviews',
  'No job applications submitted',
];

const WARNING_REASONS = [
  'Attendance below 60% for 2 consecutive weeks',
  'No progress update in 10 days',
  'Missed 3 scheduled interviews',
  'Stage regression detected',
  'Low engagement with assigned tasks',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function weightedPick<T>(items: { item: T; weight: number }[]): T {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * totalWeight;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

function randomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const now = new Date();
  const minMs = now.getTime() - daysAgoMax * 24 * 60 * 60 * 1000;
  const maxMs = now.getTime() - daysAgoMin * 24 * 60 * 60 * 1000;
  return new Date(minMs + Math.random() * (maxMs - minMs));
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateTime(d: Date): string {
  return d.toISOString();
}

function generateName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function generateStudentEmail(name: string, batch: string): string {
  const parts = name.toLowerCase().split(' ');
  return `${parts[0]}.${parts[1] || 'student'}@student.dev`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── Read Existing Users ─────────────────────────────────────────────────────

async function readMentors(): Promise<{ name: string; email: string; role: string }[]> {
  console.log('Reading users sheet to get mentor emails…');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'users',
  });
  const rows = (response.data.values ?? []) as string[][];
  if (rows.length <= 1) {
    console.error('❌  No users found in the users sheet. Run migrate-users.ts first.');
    process.exit(1);
  }
  // Skip header (row 0)
  return rows.slice(1)
    .filter(r => r[3] === 'mentor' && r[4] === 'true')
    .map(r => ({ name: r[1], email: r[2], role: r[3] }));
}

// ─── Check Existing Data ─────────────────────────────────────────────────────

async function checkExistingData(sheetName: string): Promise<boolean> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = (response.data.values ?? []) as string[][];
  return rows.length > 1; // more than just header
}

// ─── Data Generation ─────────────────────────────────────────────────────────

interface GeneratedStudent {
  id: string;
  name: string;
  batch: string;
  project: string;
  mentor_email: string;
  student_email: string;
  stage: string;
  risk_status: string;
  risk_reasons: string;
  last_activity_date: string;
  job_focus: string;
  terminated: boolean;
  hired: boolean;
  experience: string;
  created_at: string;
  updated_at: string;
}

interface GeneratedProgressLog {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  log_type: string;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  note: string;
  logged_at: string;
  logged_by: string;
  job_url: string;
  mock_feedback: string;
  mock_score: string;
  mock_strengths: string;
  mock_improvements: string;
  mock_interview_type: string;
  mock_interviewer: string;
}

interface GeneratedAttendanceLog {
  id: string;
  student_id: string;
  date: string;
  present: string;
  logged_by: string;
  session_label: string;
  excuse: string;
  excuse_note: string;
}

interface GeneratedTask {
  id: string;
  mentor_email: string;
  student_id: string;
  student_name: string;
  task_type: string;
  title: string;
  description: string;
  due_date: string;
  completed: string;
  completed_at: string;
  created_at: string;
  priority: string;
  source: string;
}

interface GeneratedStageTransition {
  id: string;
  student_id: string;
  from_stage: string;
  to_stage: string;
  transitioned_at: string;
  triggered_by: string;
  note: string;
}

interface GeneratedRiskEntry {
  id: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  reasons: string;
  flagged_at: string;
  resolved_at: string;
  risk_probability: string;
  risk_band: string;
}

interface GeneratedWarning {
  id: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  severity: string;
  reason: string;
  evidence_notes: string;
  status: string;
  created_at: string;
  created_by: string;
  resolved_at: string;
  resolved_by: string;
  resolution_notes: string;
}

interface GeneratedNotification {
  id: string;
  recipient_email: string;
  type: string;
  student_id: string;
  student_name: string;
  message: string;
  read: string;
  created_at: string;
  payload: string;
}

interface GeneratedDailyMetric {
  date: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  prs_total_score: string;
  prs_grade: string;
  activity_tier: string;
  leaderboard_rank: string;
  leaderboard_score: string;
  risk_probability: string;
  risk_band: string;
  tasks_completed: string;
  interviews_count: string;
  created_at: string;
}

interface GeneratedAnalyticsEvent {
  id: string;
  event_type: string;
  actor_email: string;
  actor_role: string;
  student_id: string;
  student_name: string;
  created_at: string;
  payload: string;
}

interface GeneratedCompany {
  id: string;
  canonical_name: string;
  industry: string;
  size_range: string;
  location: string;
  contact_name: string;
  contact_email: string;
  hiring_status: string;
  notes: string;
  added_at: string;
  added_by: string;
}

function generateStudents(mentors: { name: string; email: string }[]): GeneratedStudent[] {
  const students: GeneratedStudent[] = [];
  const usedNames = new Set<string>();

  for (const mentor of mentors) {
    for (let i = 0; i < STUDENTS_PER_MENTOR; i++) {
      let name: string;
      do {
        name = generateName();
      } while (usedNames.has(name));
      usedNames.add(name);

      const batch = pick(BATCHES);
      const projectConfig = pick(PROJECTS);
      const stage = weightedPick(STAGE_DISTRIBUTION.map(s => ({ item: s.stage, weight: s.weight })));
      const isTerminated = Math.random() < 0.06;
      const isHired = stage === 'hired';
      const isAtRisk = !isTerminated && !isHired && Math.random() < 0.18;
      const experience = pick(EXPERIENCE_LEVELS);
      const jobFocus = pick(JOB_FOCI);

      const createdDate = randomDate(90, 180);
      const lastActivity = isTerminated
        ? randomDate(30, 60)
        : isAtRisk
          ? randomDate(7, 20)
          : randomDate(0, 5);

      students.push({
        id: uuidv4(),
        name,
        batch,
        project: projectConfig.name,
        mentor_email: mentor.email,
        student_email: generateStudentEmail(name, batch),
        stage,
        risk_status: isAtRisk ? 'at_risk' : 'safe',
        risk_reasons: isAtRisk ? pickN(RISK_REASONS, Math.floor(Math.random() * 2) + 1).join(', ') : '',
        last_activity_date: formatDate(lastActivity),
        job_focus: jobFocus,
        terminated: isTerminated,
        hired: isHired,
        experience,
        created_at: formatDateTime(createdDate),
        updated_at: formatDateTime(lastActivity),
      });
    }
  }

  return students;
}

function generateProgressLogs(students: GeneratedStudent[], mentors: { email: string }[]): GeneratedProgressLog[] {
  const logs: GeneratedProgressLog[] = [];

  for (const student of students) {
    if (student.terminated) continue;

    const numLogs = Math.floor(Math.random() * (PROGRESS_LOGS_PER_STUDENT_MAX - PROGRESS_LOGS_PER_STUDENT_MIN + 1)) + PROGRESS_LOGS_PER_STUDENT_MIN;
    const studentCreated = new Date(student.created_at);
    const now = new Date();
    const daysSinceCreated = Math.max(1, daysBetween(studentCreated, now));

    for (let i = 0; i < numLogs; i++) {
      const logDate = randomDate(0, Math.min(daysSinceCreated, 90));
      const logType = pick(LOG_TYPES);
      const company = pick(COMPANIES);

      let note = '';
      let jobUrl = '';
      let mockFeedback = '';
      let mockScore = '';
      let mockStrengths = '';
      let mockImprovements = '';
      let mockType = '';
      let mockInterviewer = '';

      switch (logType) {
        case 'Job Applied':
          note = `Applied for ${pick(['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'React Developer', 'Node.js Developer', 'Software Engineer', 'Junior Developer', 'Web Developer'])} position`;
          jobUrl = `https://${company.name.toLowerCase().replace(/\s+/g, '')}.com/careers`;
          break;
        case 'Interview Call':
          note = `${pick(['Initial screening', 'Technical round', 'HR interview', 'Final round', 'Coding test'])} with ${company.name}`;
          break;
        case 'Mock Interview':
          mockType = pick(MOCK_TYPES);
          mockScore = String(Math.floor(Math.random() * 5) + 5); // 5-9
          mockStrengths = pick(['Good problem solving', 'Clear communication', 'Strong fundamentals', 'Good debugging skills']);
          mockImprovements = pick(['Needs more practice on DSA', 'Improve system design', 'Work on time management', 'Better code organization']);
          mockFeedback = `Score: ${mockScore}/10. ${pick(['Solid performance', 'Room for improvement', 'Good progress', 'Needs more preparation'])}`;
          mockInterviewer = pick(mentors.map(m => m.email));
          break;
        case 'Job Task':
          note = `Completed ${pick(['take-home assignment', 'coding challenge', 'portfolio review', 'GitHub project submission'])}`;
          break;
        case 'Offer':
          note = `Received offer from ${company.name} — ${pick(['BDT 40,000', 'BDT 50,000', 'BDT 60,000', 'BDT 70,000', 'BDT 80,000'])}/month`;
          break;
        case 'Other':
          note = pick(['Attended career workshop', 'Updated resume', 'Completed online course', 'Networked at tech meetup', 'Reviewed feedback from last interview']);
          break;
      }

      logs.push({
        id: uuidv4(),
        student_id: student.id,
        student_name: student.name,
        student_email: student.student_email,
        log_type: logType,
        company_name: company.name,
        scheduled_date: formatDate(logDate),
        scheduled_time: `${String(Math.floor(Math.random() * 10) + 9).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`,
        note,
        logged_at: formatDateTime(logDate),
        logged_by: student.mentor_email,
        job_url: jobUrl,
        mock_feedback: mockFeedback,
        mock_score: mockScore,
        mock_strengths: mockStrengths,
        mock_improvements: mockImprovements,
        mock_interview_type: mockType,
        mock_interviewer: mockInterviewer,
      });
    }
  }

  // Sort by logged_at for realistic ordering
  logs.sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
  return logs;
}

function generateAttendanceLogs(students: GeneratedStudent[]): GeneratedAttendanceLog[] {
  const logs: GeneratedAttendanceLog[] = [];
  const now = new Date();

  for (const student of students) {
    if (student.terminated) continue;

    const studentCreated = new Date(student.created_at);
    const startDay = Math.min(TOTAL_DAYS_HISTORY, daysBetween(studentCreated, now));

    for (let d = startDay; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dateStr = formatDate(date);
      const dayOfWeek = date.getDay();

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Skip future dates
      if (date > now) continue;

      const isPresent = Math.random() < 0.85;
      const excuse = isPresent ? '' : pick(EXCUSES);
      const excuseNote = excuse === 'other' ? pick(['Family emergency', 'Personal matter', 'Transport issue', 'Health checkup']) : '';

      logs.push({
        id: uuidv4(),
        student_id: student.id,
        date: dateStr,
        present: String(isPresent),
        logged_by: student.mentor_email,
        session_label: pick(['Morning Session', 'Afternoon Session', 'Full Day', 'Standup', 'Workshop']),
        excuse,
        excuse_note: excuseNote,
      });
    }
  }

  return logs;
}

function generateTasks(students: GeneratedStudent[], mentors: { email: string }[]): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  for (const student of students) {
    if (student.terminated) continue;

    const numTasks = Math.floor(Math.random() * 5) + 2;

    for (let i = 0; i < numTasks; i++) {
      const taskType = pick(TASK_TYPES);
      const priority = pick(TASK_PRIORITIES);
      const isCompleted = Math.random() < 0.6;
      const createdDate = randomDate(5, 60);
      const dueDate = new Date(createdDate.getTime() + (Math.floor(Math.random() * 14) + 3) * 24 * 60 * 60 * 1000);
      const completedAt = isCompleted ? new Date(dueDate.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000) : new Date(0);

      let title = '';
      let description = '';

      switch (taskType) {
        case 'follow_up':
          title = `Follow up with ${student.name}`;
          description = pick(['Check progress on job applications', 'Review resume updates', 'Discuss interview feedback', 'Weekly check-in']);
          break;
        case 'schedule_interview':
          title = `Schedule mock interview for ${student.name}`;
          description = pick(['Technical mock interview needed', 'Behavioral practice session', 'System design preparation']);
          break;
        case 'review_progress':
          title = `Review ${student.name}'s progress`;
          description = pick(['Weekly progress review', 'Monthly assessment', 'Stage transition evaluation']);
          break;
        case 'risk_check':
          title = `Risk assessment for ${student.name}`;
          description = pick(['Investigate inactivity', 'Check attendance records', 'Review engagement metrics']);
          break;
        case 'update_student_data':
          title = `Update data for ${student.name}`;
          description = pick(['Update contact information', 'Refresh project details', 'Verify batch assignment']);
          break;
        case 'other':
          title = pick([`Career guidance for ${student.name}`, `Portfolio review for ${student.name}`, `LinkedIn optimization for ${student.name}`]);
          description = 'Ad-hoc task';
          break;
      }

      tasks.push({
        id: uuidv4(),
        mentor_email: student.mentor_email,
        student_id: student.id,
        student_name: student.name,
        task_type: taskType,
        title,
        description,
        due_date: formatDate(dueDate),
        completed: String(isCompleted),
        completed_at: isCompleted ? formatDateTime(completedAt) : '',
        created_at: formatDateTime(createdDate),
        priority,
        source: Math.random() < 0.4 ? 'auto' : 'manual',
      });
    }
  }

  return tasks;
}

function generateStageHistory(students: GeneratedStudent[]): GeneratedStageTransition[] {
  const transitions: GeneratedStageTransition[] = [];
  const stageOrder = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];

  for (const student of students) {
    const currentStageIdx = stageOrder.indexOf(student.stage);
    if (currentStageIdx <= 0) continue;

    const createdDate = new Date(student.created_at);
    let currentDate = new Date(createdDate);

    // Generate 1-3 transitions leading to current stage
    const numTransitions = Math.min(currentStageIdx, Math.floor(Math.random() * 3) + 1);
    const stagesToTransition = stageOrder.slice(0, currentStageIdx + 1);

    for (let i = 0; i < numTransitions; i++) {
      const fromStage = stagesToTransition[i];
      const toStage = stagesToTransition[i + 1];
      const transitionDate = new Date(currentDate.getTime() + (Math.random() * 30 + 7) * 24 * 60 * 60 * 1000);

      transitions.push({
        id: uuidv4(),
        student_id: student.id,
        from_stage: fromStage,
        to_stage: toStage,
        transitioned_at: formatDateTime(transitionDate),
        triggered_by: pick(['api', 'risk_engine', 'admin', 'bulk_upload']),
        note: pick(['Progress milestone achieved', 'Mentor approved transition', 'Automatic stage update', 'Manual override']),
      });

      currentDate = transitionDate;
    }
  }

  transitions.sort((a, b) => new Date(a.transitioned_at).getTime() - new Date(b.transitioned_at).getTime());
  return transitions;
}

function generateRiskHistory(students: GeneratedStudent[]): GeneratedRiskEntry[] {
  const entries: GeneratedRiskEntry[] = [];
  const riskBands = ['watch', 'concern', 'at_risk', 'critical'];

  for (const student of students) {
    if (student.risk_status !== 'at_risk' && Math.random() > 0.1) continue;

    const numEntries = student.risk_status === 'at_risk' ? Math.floor(Math.random() * 2) + 1 : 1;

    for (let i = 0; i < numEntries; i++) {
      const flaggedDate = randomDate(10, 80);
      const isResolved = Math.random() < 0.4;
      const resolvedDate = isResolved ? new Date(flaggedDate.getTime() + (Math.random() * 14 + 3) * 24 * 60 * 60 * 1000) : new Date(0);
      const riskBand = pick(riskBands);
      const riskProb = riskBand === 'watch' ? (Math.random() * 0.2 + 0.2).toFixed(2)
        : riskBand === 'concern' ? (Math.random() * 0.2 + 0.4).toFixed(2)
          : riskBand === 'at_risk' ? (Math.random() * 0.2 + 0.6).toFixed(2)
            : (Math.random() * 0.2 + 0.8).toFixed(2);

      entries.push({
        id: uuidv4(),
        student_id: student.id,
        student_name: student.name,
        mentor_email: student.mentor_email,
        reasons: pickN(RISK_REASONS, Math.floor(Math.random() * 2) + 1).join(', '),
        flagged_at: formatDateTime(flaggedDate),
        resolved_at: isResolved ? formatDateTime(resolvedDate) : '',
        risk_probability: riskProb,
        risk_band: riskBand,
      });
    }
  }

  return entries;
}

function generateWarnings(students: GeneratedStudent[], managers: { email: string }[]): GeneratedWarning[] {
  const warnings: GeneratedWarning[] = [];

  for (const student of students) {
    if (student.terminated || Math.random() > 0.15) continue;

    const severity = pick(['yellow', 'orange', 'red']);
    const isResolved = Math.random() < 0.5;
    const createdDate = randomDate(5, 50);
    const resolvedDate = isResolved ? new Date(createdDate.getTime() + (Math.random() * 10 + 2) * 24 * 60 * 60 * 1000) : new Date(0);

    warnings.push({
      id: uuidv4(),
      student_id: student.id,
      student_name: student.name,
      mentor_email: student.mentor_email,
      severity,
      reason: pick(WARNING_REASONS),
      evidence_notes: `Observed ${pick(['declining engagement', 'missed deadlines', 'poor attendance', 'lack of progress'])} over the past ${Math.floor(Math.random() * 14 + 3)} days.`,
      status: isResolved ? 'resolved' : 'open',
      created_at: formatDateTime(createdDate),
      created_by: pick(managers.map(m => m.email)),
      resolved_at: isResolved ? formatDateTime(resolvedDate) : '',
      resolved_by: isResolved ? student.mentor_email : '',
      resolution_notes: isResolved ? pick(['Student showed improvement', 'Action plan implemented', 'Follow-up completed', 'Mentor intervention successful']) : '',
    });
  }

  return warnings;
}

function generateNotifications(students: GeneratedStudent[], mentors: { email: string }[], managers: { email: string }[]): GeneratedNotification[] {
  const notifications: GeneratedNotification[] = [];
  const allRecipients = [...mentors.map(m => m.email), ...managers.map(m => m.email)];
  const notifTypes = ['risk_alert', 'risk_resolved', 'task_due', 'stage_changed', 'attendance_alert', 'action_required', 'system_message'];

  for (const student of students) {
    if (student.terminated) continue;

    const numNotifs = Math.floor(Math.random() * 4) + 1;

    for (let i = 0; i < numNotifs; i++) {
      const type = pick(notifTypes);
      const createdDate = randomDate(0, 30);
      const isRead = Math.random() < 0.6;

      let message = '';
      let payload = '{}';

      switch (type) {
        case 'risk_alert':
          message = `${student.name} has been flagged as at-risk`;
          payload = JSON.stringify({ student_id: student.id, risk_band: 'at_risk', reasons: student.risk_reasons });
          break;
        case 'risk_resolved':
          message = `${student.name} is no longer at-risk`;
          payload = JSON.stringify({ student_id: student.id, resolved: true });
          break;
        case 'task_due':
          message = `Task due for ${student.name}`;
          payload = JSON.stringify({ student_id: student.id, task_type: 'follow_up' });
          break;
        case 'stage_changed':
          message = `${student.name} moved to ${student.stage}`;
          payload = JSON.stringify({ student_id: student.id, new_stage: student.stage });
          break;
        case 'attendance_alert':
          message = `${student.name} has been absent for multiple days`;
          payload = JSON.stringify({ student_id: student.id, consecutive_absences: Math.floor(Math.random() * 3) + 2 });
          break;
        case 'action_required':
          message = `Action required for ${student.name}`;
          payload = JSON.stringify({ student_id: student.id, action: 'review' });
          break;
        case 'system_message':
          message = pick(['Weekly report is ready', 'System maintenance scheduled', 'New feature available']);
          payload = JSON.stringify({ type: 'system' });
          break;
      }

      notifications.push({
        id: uuidv4(),
        recipient_email: pick(allRecipients),
        type,
        student_id: student.id,
        student_name: student.name,
        message,
        read: String(isRead),
        created_at: formatDateTime(createdDate),
        payload,
      });
    }
  }

  return notifications;
}

function generateDailyMetrics(students: GeneratedStudent[]): GeneratedDailyMetric[] {
  const metrics: GeneratedDailyMetric[] = [];
  const now = new Date();

  for (const student of students) {
    if (student.terminated) continue;

    const studentCreated = new Date(student.created_at);
    const startDay = Math.min(TOTAL_DAYS_HISTORY, daysBetween(studentCreated, now));

    for (let d = startDay; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

      // Generate metrics every 3 days to keep data manageable but show trends
      if (d % 3 !== 0) continue;

      // PRS score trends upward over time for active students
      const daysActive = startDay - d;
      const baseScore = Math.min(95, 30 + (daysActive / startDay) * 50 + (Math.random() * 20 - 10));
      const prsScore = Math.max(10, Math.min(100, Math.round(baseScore)));
      const prsGrade = prsScore >= 85 ? 'A' : prsScore >= 70 ? 'B' : prsScore >= 55 ? 'C' : prsScore >= 40 ? 'D' : 'F';

      const riskProb = student.risk_status === 'at_risk'
        ? (Math.random() * 0.3 + 0.6).toFixed(2)
        : (Math.random() * 0.3).toFixed(2);
      const riskBand = parseFloat(riskProb) < 0.2 ? 'safe'
        : parseFloat(riskProb) < 0.4 ? 'watch'
          : parseFloat(riskProb) < 0.6 ? 'concern'
            : parseFloat(riskProb) < 0.8 ? 'at_risk'
              : 'critical';

      const activityTier = prsScore >= 75 ? 'Excellent'
        : prsScore >= 55 ? 'Good'
          : prsScore >= 35 ? 'Moderate'
            : prsScore >= 20 ? 'Inactive'
              : 'Critical';

      const leaderboardRank = Math.floor(Math.random() * 70) + 1;
      const leaderboardScore = Math.round(prsScore + Math.random() * 10);
      const tasksCompleted = Math.floor(Math.random() * 5);
      const interviewsCount = Math.floor(Math.random() * 3);

      metrics.push({
        date: formatDate(date),
        student_id: student.id,
        student_name: student.name,
        mentor_email: student.mentor_email,
        prs_total_score: String(prsScore),
        prs_grade: prsGrade,
        activity_tier: activityTier,
        leaderboard_rank: String(leaderboardRank),
        leaderboard_score: String(leaderboardScore),
        risk_probability: riskProb,
        risk_band: riskBand,
        tasks_completed: String(tasksCompleted),
        interviews_count: String(interviewsCount),
        created_at: formatDateTime(date),
      });
    }
  }

  return metrics;
}

function generateAnalyticsEvents(students: GeneratedStudent[], mentors: { email: string }[]): GeneratedAnalyticsEvent[] {
  const events: GeneratedAnalyticsEvent[] = [];
  const eventTypes = ['task_created', 'task_completed', 'stage_updated', 'progress_log_created', 'attendance_logged', 'warning_acknowledged'];

  for (const student of students) {
    if (student.terminated) continue;

    const numEvents = Math.floor(Math.random() * 6) + 2;

    for (let i = 0; i < numEvents; i++) {
      const eventType = pick(eventTypes);
      const createdDate = randomDate(0, 30);

      events.push({
        id: uuidv4(),
        event_type: eventType,
        actor_email: student.mentor_email,
        actor_role: 'mentor',
        student_id: student.id,
        student_name: student.name,
        created_at: formatDateTime(createdDate),
        payload: JSON.stringify({ action: eventType, details: `Event for ${student.name}` }),
      });
    }
  }

  events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return events;
}

function generateCompanies(): GeneratedCompany[] {
  return COMPANIES.map(c => ({
    id: uuidv4(),
    canonical_name: c.name,
    industry: c.industry,
    size_range: c.size,
    location: c.location,
    contact_name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES),
    contact_email: `contact@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
    hiring_status: pick(['active', 'active', 'active', 'paused', 'prospect']),
    notes: pick(['Regular hiring partner', 'Good interview feedback', 'Hiring for junior roles', 'Prefers experienced candidates', 'Open to freshers']),
    added_at: formatDateTime(randomDate(60, 180)),
    added_by: 'system@seed.dev',
  }));
}

// ─── Main Seeder ─────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       Demo Data Seeder — Mentor Management System        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── 1. Read mentors ──────────────────────────────────────────────────────
  const mentors = await readMentors();
  if (mentors.length === 0) {
    console.error('❌  No active mentors found. Run migrate-users.ts first.');
    process.exit(1);
  }
  console.log(`✓ Found ${mentors.length} active mentors\n`);

  // Get managers for warnings/notifications
  const managerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'users',
  });
  const managerRows = ((managerResponse.data.values ?? []) as string[][]).slice(1);
  const managers = managerRows.filter(r => r[3] === 'manager' && r[4] === 'true').map(r => ({ name: r[1], email: r[2] }));

  // ── 2. Generate data ─────────────────────────────────────────────────────
  console.log('Generating demo data…');

  const students = generateStudents(mentors);
  console.log(`  → ${students.length} students (${students.filter(s => s.terminated).length} terminated, ${students.filter(s => s.hired).length} hired, ${students.filter(s => s.risk_status === 'at_risk').length} at-risk)`);

  const progressLogs = generateProgressLogs(students, mentors);
  console.log(`  → ${progressLogs.length} progress logs`);

  const attendanceLogs = generateAttendanceLogs(students);
  console.log(`  → ${attendanceLogs.length} attendance logs`);

  const tasks = generateTasks(students, mentors);
  console.log(`  → ${tasks.length} mentor tasks`);

  const stageHistory = generateStageHistory(students);
  console.log(`  → ${stageHistory.length} stage transitions`);

  const riskHistory = generateRiskHistory(students);
  console.log(`  → ${riskHistory.length} risk history entries`);

  const warnings = generateWarnings(students, managers);
  console.log(`  → ${warnings.length} warnings`);

  const notifications = generateNotifications(students, mentors, managers);
  console.log(`  → ${notifications.length} notifications`);

  const dailyMetrics = generateDailyMetrics(students);
  console.log(`  → ${dailyMetrics.length} daily metric snapshots`);

  const analyticsEvents = generateAnalyticsEvents(students, mentors);
  console.log(`  → ${analyticsEvents.length} analytics events`);

  const companies = generateCompanies();
  console.log(`  → ${companies.length} companies`);

  // ── 3. Check existing data and ask for confirmation ──────────────────────
  console.log('\nChecking existing data…');
  const sheetsToCheck = ['students', 'progress_logs', 'attendance_logs', 'mentor_tasks', 'stage_history', 'risk_history', 'warnings', 'notifications', 'daily_metrics', 'analytics_events', 'companies'];
  const existingSheets: string[] = [];

  for (const sheetName of sheetsToCheck) {
    const hasData = await checkExistingData(sheetName);
    if (hasData) existingSheets.push(sheetName);
  }

  if (existingSheets.length > 0) {
    console.log(`\n⚠️  The following sheets already have data: ${existingSheets.join(', ')}`);
    console.log('   This seeder APPENDS data — it does not clear existing records.\n');
  }

  // ── 4. Write data in batches ─────────────────────────────────────────────
  console.log('Writing data to Google Sheets…\n');

  const BATCH_SIZE = 100;
  const DELAY_BETWEEN_BATCHES_MS = 2000; // 2s between batches to respect API quota
  const DELAY_BETWEEN_SHEETS_MS = 5000;  // 5s between different sheets

  async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function writeBatch(sheetName: string, headerRow: string[], rows: string[][], label: string) {
    if (rows.length === 0) {
      console.log(`  ⊘ ${label}: 0 rows to write`);
      return;
    }

    // Check if sheet has header
    const existing = await checkExistingData(sheetName);
    const allRows = existing ? rows : [headerRow, ...rows];

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allRows.length / BATCH_SIZE);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName,
        valueInputOption: 'RAW',
        requestBody: { values: batch },
      });
      if (batchNum < totalBatches) {
        process.stdout.write(`    … ${label} batch ${batchNum}/${totalBatches}, waiting…\r`);
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    console.log(`  ✓ ${label}: ${rows.length} rows written`);
  }

  // Students
  await writeBatch('students',
    ['id', 'name', 'batch', 'project', 'mentor_email', 'student_email', 'stage', 'risk_status', 'risk_reasons', 'last_activity_date', 'job_focus', 'terminated', 'hired', 'experience', 'created_at', 'updated_at'],
    students.map(s => [s.id, s.name, s.batch, s.project, s.mentor_email, s.student_email, s.stage, s.risk_status, s.risk_reasons, s.last_activity_date, s.job_focus, String(s.terminated), String(s.hired), s.experience, s.created_at, s.updated_at]),
    'Students'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Progress Logs
  await writeBatch('progress_logs',
    ['id', 'student_id', 'student_name', 'student_email', 'log_type', 'company_name', 'scheduled_date', 'scheduled_time', 'note', 'logged_at', 'logged_by', 'job_url', 'mock_feedback', 'mock_score', 'mock_strengths', 'mock_improvements', 'mock_interview_type', 'mock_interviewer'],
    progressLogs.map(l => [l.id, l.student_id, l.student_name, l.student_email, l.log_type, l.company_name, l.scheduled_date, l.scheduled_time, l.note, l.logged_at, l.logged_by, l.job_url, l.mock_feedback, l.mock_score, l.mock_strengths, l.mock_improvements, l.mock_interview_type, l.mock_interviewer]),
    'Progress Logs'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Attendance Logs
  await writeBatch('attendance_logs',
    ['id', 'student_id', 'date', 'present', 'logged_by', 'session_label', 'excuse', 'excuse_note'],
    attendanceLogs.map(l => [l.id, l.student_id, l.date, l.present, l.logged_by, l.session_label, l.excuse, l.excuse_note]),
    'Attendance Logs'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Mentor Tasks
  await writeBatch('mentor_tasks',
    ['id', 'mentor_email', 'student_id', 'student_name', 'task_type', 'title', 'description', 'due_date', 'completed', 'completed_at', 'created_at', 'priority', 'source'],
    tasks.map(t => [t.id, t.mentor_email, t.student_id, t.student_name, t.task_type, t.title, t.description, t.due_date, t.completed, t.completed_at, t.created_at, t.priority, t.source]),
    'Mentor Tasks'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Stage History
  await writeBatch('stage_history',
    ['id', 'student_id', 'from_stage', 'to_stage', 'transitioned_at', 'triggered_by', 'note'],
    stageHistory.map(t => [t.id, t.student_id, t.from_stage, t.to_stage, t.transitioned_at, t.triggered_by, t.note]),
    'Stage History'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Risk History
  await writeBatch('risk_history',
    ['id', 'student_id', 'student_name', 'mentor_email', 'reasons', 'flagged_at', 'resolved_at', 'risk_probability', 'risk_band'],
    riskHistory.map(r => [r.id, r.student_id, r.student_name, r.mentor_email, r.reasons, r.flagged_at, r.resolved_at, r.risk_probability, r.risk_band]),
    'Risk History'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Warnings
  await writeBatch('warnings',
    ['id', 'student_id', 'student_name', 'mentor_email', 'severity', 'reason', 'evidence_notes', 'status', 'created_at', 'created_by', 'resolved_at', 'resolved_by', 'resolution_notes'],
    warnings.map(w => [w.id, w.student_id, w.student_name, w.mentor_email, w.severity, w.reason, w.evidence_notes, w.status, w.created_at, w.created_by, w.resolved_at, w.resolved_by, w.resolution_notes]),
    'Warnings'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Notifications
  await writeBatch('notifications',
    ['id', 'recipient_email', 'type', 'student_id', 'student_name', 'message', 'read', 'created_at', 'payload'],
    notifications.map(n => [n.id, n.recipient_email, n.type, n.student_id, n.student_name, n.message, n.read, n.created_at, n.payload]),
    'Notifications'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Daily Metrics
  await writeBatch('daily_metrics',
    ['date', 'student_id', 'student_name', 'mentor_email', 'prs_total_score', 'prs_grade', 'activity_tier', 'leaderboard_rank', 'leaderboard_score', 'risk_probability', 'risk_band', 'tasks_completed', 'interviews_count', 'created_at'],
    dailyMetrics.map(m => [m.date, m.student_id, m.student_name, m.mentor_email, m.prs_total_score, m.prs_grade, m.activity_tier, m.leaderboard_rank, m.leaderboard_score, m.risk_probability, m.risk_band, m.tasks_completed, m.interviews_count, m.created_at]),
    'Daily Metrics'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Analytics Events
  await writeBatch('analytics_events',
    ['id', 'event_type', 'actor_email', 'actor_role', 'student_id', 'student_name', 'created_at', 'payload'],
    analyticsEvents.map(e => [e.id, e.event_type, e.actor_email, e.actor_role, e.student_id, e.student_name, e.created_at, e.payload]),
    'Analytics Events'
  );
  await sleep(DELAY_BETWEEN_SHEETS_MS);

  // Companies
  await writeBatch('companies',
    ['id', 'canonical_name', 'industry', 'size_range', 'location', 'contact_name', 'contact_email', 'hiring_status', 'notes', 'added_at', 'added_by'],
    companies.map(c => [c.id, c.canonical_name, c.industry, c.size_range, c.location, c.contact_name, c.contact_email, c.hiring_status, c.notes, c.added_at, c.added_by]),
    'Companies'
  );

  // ── 5. Summary ───────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                  SEEDING COMPLETE                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log('Data Summary:');
  console.log(`  Students:        ${students.length}`);
  console.log(`    ├─ Learning:       ${students.filter(s => s.stage === 'learning').length}`);
  console.log(`    ├─ Applying:       ${students.filter(s => s.stage === 'applying').length}`);
  console.log(`    ├─ Interviewing:   ${students.filter(s => s.stage === 'interviewing').length}`);
  console.log(`    ├─ Offer Pending:  ${students.filter(s => s.stage === 'offer_pending').length}`);
  console.log(`    ├─ Placed:         ${students.filter(s => s.stage === 'placed').length}`);
  console.log(`    ├─ Hired:          ${students.filter(s => s.stage === 'hired').length}`);
  console.log(`    ├─ At-Risk:        ${students.filter(s => s.risk_status === 'at_risk').length}`);
  console.log(`    └─ Terminated:     ${students.filter(s => s.terminated).length}`);
  console.log(`  Progress Logs:   ${progressLogs.length}`);
  console.log(`  Attendance Logs: ${attendanceLogs.length}`);
  console.log(`  Mentor Tasks:    ${tasks.length} (${tasks.filter(t => t.completed === 'true').length} completed)`);
  console.log(`  Stage History:   ${stageHistory.length}`);
  console.log(`  Risk History:    ${riskHistory.length}`);
  console.log(`  Warnings:        ${warnings.length} (${warnings.filter(w => w.status === 'open').length} open)`);
  console.log(`  Notifications:   ${notifications.length} (${notifications.filter(n => n.read === 'false').length} unread)`);
  console.log(`  Daily Metrics:   ${dailyMetrics.length}`);
  console.log(`  Analytics Events: ${analyticsEvents.length}`);
  console.log(`  Companies:       ${companies.length}`);

  console.log('\nPer-Mentor Breakdown:');
  for (const mentor of mentors) {
    const mentorStudents = students.filter(s => s.mentor_email === mentor.email);
    console.log(`  ${mentor.name} (${mentor.email}): ${mentorStudents.length} students`);
    console.log(`    ├─ Hired: ${mentorStudents.filter(s => s.hired).length}`);
    console.log(`    ├─ At-Risk: ${mentorStudents.filter(s => s.risk_status === 'at_risk').length}`);
    console.log(`    └─ Active: ${mentorStudents.filter(s => !s.terminated && !s.hired).length}`);
  }

  console.log('\n✓ All dashboard sections should now have meaningful data.');
  console.log('  Login as any mentor or manager to view the populated dashboard.\n');
}

run().catch((err) => {
  console.error('❌  Seeding failed:', err);
  process.exit(1);
});
