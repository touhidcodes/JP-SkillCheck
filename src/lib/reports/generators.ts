/**
 * Report generator for Weekly Program Report.
 * Outputs KPI summary, at-risk list, placements, interviews, top performers.
 */
import * as XLSX from 'xlsx';
import { readSheet } from '@/lib/sheets/client';
import { format } from 'date-fns';

export async function generateWeeklyProgramReport(from: string, to: string) {
  const [studentRows, progressLogRows, metricRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
    readSheet('daily_metrics'),
  ]);

  const workbook = XLSX.utils.book_new();

  const activeStudents = studentRows.filter(r => r[11] !== 'true' && r[12] !== 'true');
  const hiredStudents = studentRows.filter(r => r[12] === 'true');
  const atRiskStudents = metricRows.filter(r => r[10] === 'at_risk' || r[10] === 'critical');

  const kpiSheet = [
    ['Weekly Program Report', format(new Date(), 'yyyy-MM-dd')],
    ['Period', `${from} to ${to}`],
    [],
    ['Total Active Students', String(activeStudents.length)],
    ['Total Placed/Hired', String(hiredStudents.length)],
    ['Placement Rate', `${hiredStudents.length > 0 ? Math.round((hiredStudents.length / activeStudents.length) * 100) : 0}%`],
    ['At-Risk Students', String(atRiskStudents.length)],
    [],
    ['New Placements This Week', String(hiredStudents.length)],
  ];
  const kpiWs = XLSX.utils.aoa_to_sheet(kpiSheet);
  XLSX.utils.book_append_sheet(workbook, kpiWs, 'KPI Summary');

  const atRiskData = [['Student Name', 'Mentor Email', 'Risk Band', 'PRS Score', 'Description']];
  for (const row of atRiskStudents) {
    atRiskData.push([row[2] || '', row[3] || '', row[10] || '', row[4] || '', row[8] || '']);
  }
  const arWs = XLSX.utils.aoa_to_sheet(atRiskData);
  XLSX.utils.book_append_sheet(workbook, arWs, 'At-Risk Students');

  const weekLogs = progressLogRows.filter(r => r[9] >= from && r[9] <= to && r[4]);
  const interviewLogs = weekLogs.filter(r => r[4] === 'Interview Call');
  const offerLogs = weekLogs.filter(r => r[4] === 'Offer');

  const interviewSheet = [['Date', 'Student', 'Company', 'Type']];
  for (const log of interviewLogs) {
    interviewSheet.push([log[9] || '', log[2] || '', log[5] || '', log[4] || '']);
  }
  const intWs = XLSX.utils.aoa_to_sheet(interviewSheet);
  XLSX.utils.book_append_sheet(workbook, intWs, 'Interviews This Week');

  const offerSheet = [['Date', 'Student', 'Company', 'Role']];
  for (const log of offerLogs) {
    offerSheet.push([log[9] || '', log[2] || '', log[5] || '', log[8] || '']);
  }
  const offWs = XLSX.utils.aoa_to_sheet(offerSheet);
  XLSX.utils.book_append_sheet(workbook, offWs, 'Offers This Week');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export async function generateMentorPerformanceReport(mentorEmail: string, from: string, to: string) {
  const [studentRows, progressLogRows, taskRows, metricRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
    readSheet('mentor_tasks'),
    readSheet('daily_metrics'),
  ]);

  const workbook = XLSX.utils.book_new();

  const mentorStudents = studentRows.filter(r => r[4] === mentorEmail && r[11] !== 'true');

  const summary = [
    ['Mentor Performance Report', mentorEmail],
    ['Period', `${from} to ${to}`],
    ['Cohort Size', String(mentorStudents.length)],
  ];
  const sumWs = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(workbook, sumWs, 'Summary');

  const studentDetail = [['Student', 'PRS Score', 'Risk Band', 'Stage', 'Tasks', 'Interviews']];
  for (const student of mentorStudents) {
    const metrics = metricRows.filter(r => r[1] === student[0]).sort((a, b) => b[0].localeCompare(a[0]));
    const latestMetric = metrics[0] || [];
    const tasks = taskRows.filter(r => r[2] === student[0] && r[13] === 'true').length;
    const interviews = progressLogRows.filter(r => r[1] === student[0] && r[9] >= from && r[9] <= to && r[4] === 'Interview Call').length;
    studentDetail.push([
      student[1] || '', latestMetric[4] || '0', latestMetric[10] || 'safe',
      student[6] || '', String(tasks), String(interviews),
    ]);
  }
  const sdWs = XLSX.utils.aoa_to_sheet(studentDetail);
  XLSX.utils.book_append_sheet(workbook, sdWs, 'Student Detail');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export async function generateStudentDetailReport(studentId: string) {
  const [studentRows, progressLogRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
  ]);

  const workbook = XLSX.utils.book_new();
  const student = studentRows.find(r => r[0] === studentId);
  if (!student) throw new Error('Student not found');

  const info = [
    ['Student Detail Report', student[1] || ''],
    ['ID', student[0] || ''],
    ['Mentor', student[4] || ''],
    ['Stage', student[6] || ''],
    ['Batch', student[2] || ''],
    [],
    ['Progress Logs']];
  const infoWs = XLSX.utils.aoa_to_sheet(info);
  XLSX.utils.book_append_sheet(workbook, infoWs, 'Student Info');

  const logs = progressLogRows.filter(r => r[1] === studentId);
  const logSheet = [['Date', 'Type', 'Company', 'Note']];
  for (const log of logs) {
    logSheet.push([log[9] || '', log[4] || '', log[5] || '', log[8] || '']);
  }
  const logWs = XLSX.utils.aoa_to_sheet(logSheet);
  XLSX.utils.book_append_sheet(workbook, logWs, 'Progress Logs');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export async function generateCohortCompletionReport(batch: string) {
  const [studentRows] = await Promise.all([
    readSheet('students'),
  ]);

  const workbook = XLSX.utils.book_new();
  const batchStudents = studentRows.filter(r => r[2] === batch);
  const active = batchStudents.filter(r => r[11] !== 'true');
  const placed = batchStudents.filter(r => r[12] === 'true');

  const summary = [
    ['Cohort Completion Report', batch],
    ['Total Students', String(batchStudents.length)],
    ['Active', String(active.length)],
    ['Placed/Hired', String(placed.length)],
    ['Placement Rate', `${batchStudents.length > 0 ? Math.round((placed.length / batchStudents.length) * 100) : 0}%`],
  ];
  const sumWs = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(workbook, sumWs, 'Summary');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

export async function generateCompanyHiringReport() {
  const [progressLogRows] = await Promise.all([readSheet('progress_logs')]);

  const workbook = XLSX.utils.book_new();
  const offerLogs = progressLogRows.filter(r => r[4] === 'Offer');

  const sheet = [['Student', 'Company', 'Role', 'Salary', 'Logged Date', 'Deadline']];
  for (const log of offerLogs) {
    sheet.push([log[2] || '', log[5] || '', log[8] || '', '', log[9] || '', log[6] || '']);
  }
  const ws = XLSX.utils.aoa_to_sheet(sheet);
  XLSX.utils.book_append_sheet(workbook, ws, 'Offers');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}