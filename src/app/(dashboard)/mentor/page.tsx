"use client";

import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UniversalExcelImport } from "@/components/import/universal-excel-import";
import { usePlacementStore } from "@/lib/placement/store";
import { buildRiskTrend } from "@/lib/risk/placement-risk";
import { MentorDashboardHeader } from "@/components/mentor/mentor-dashboard-header";
import { MentorStatsGrid } from "@/components/mentor/mentor-stats-grid";
import { StageDistributionCard } from "@/components/mentor/stage-distribution-card";
import { AttendanceTrendCard } from "@/components/mentor/attendance-trend-card";
import { RiskOverTimeCard } from "@/components/mentor/risk-over-time-card";
import { BatchPerformanceCard } from "@/components/mentor/batch-performance-card";
import { MentorActivityFeed } from "@/components/mentor/mentor-activity-feed";
import { MentorSmartNudges } from "@/components/mentor/mentor-smart-nudges";

function computeDashboardMetrics(students: any[], filteredStudents: any[], riskScores: any[], attendance: any[]) {
  const total = students.length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const addedThisMonth = filteredStudents.filter(s => (s.created_at || s.join_date || "").slice(0, 7) === currentMonth).length;
  const totalMenteesSubtitle = addedThisMonth > 0 ? `↑${addedThisMonth} this month` : "No new mentees this month";

  const hiredThisMonth = filteredStudents.filter(s => s.hired && (s.hired_date || s.updated_at || "").slice(0, 7) === currentMonth).length;
  const highRisk = riskScores.filter((risk) => filteredStudents.some(s => s.id === risk.student_id) && risk.level === "high").length;
  const highRiskSubtitle = highRisk > 0 ? `${highRisk} need immediate attention` : "All clear";

  const filteredAttendance = attendance.filter(record => filteredStudents.some(s => s.id === record.student_id));
  const present = filteredAttendance.filter((record) => record.present).length;
  const avgAttendance = filteredAttendance.length ? Math.round((present / filteredAttendance.length) * 100) : 0;

  const activeThisWeek = filteredStudents.filter((student) => {
    const date = new Date(student.last_activity_date || student.updated_at || "");
    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const stageData = ["learning", "applying", "interviewing", "offer_pending", "placed", "hired"].map((stage) => ({
    stageId: stage,
    name: stage.replace("_", " "),
    value: filteredStudents.filter((student) => student.stage === stage).length,
    fill: `var(--color-${stage})`,
  }));

  const groupedByDate = filteredAttendance.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = { total: 0, present: 0 };
    acc[curr.date].total += 1;
    if (curr.present) acc[curr.date].present += 1;
    return acc;
  }, {} as Record<string, { total: number; present: number }>);

  const sortedDates = Object.keys(groupedByDate).sort();
  const attendanceTrend = sortedDates.slice(-8).map((date, index) => {
    const stats = groupedByDate[date];
    const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    return { date, session: `S${index + 1}`, attendance: rate, present: stats.present, absent: stats.total - stats.present };
  });

  const lastSessionRate = attendanceTrend.length > 0 ? attendanceTrend[attendanceTrend.length - 1].attendance : avgAttendance;
  const prevSessionRate = attendanceTrend.length > 1 ? attendanceTrend[attendanceTrend.length - 2].attendance : avgAttendance;
  const rateDiff = lastSessionRate - prevSessionRate;
  const avgAttendanceSubtitle = attendanceTrend.length > 1
    ? (rateDiff > 0 ? `↑${rateDiff}% from last session` : rateDiff < 0 ? `↓${Math.abs(rateDiff)}% from last session` : "No change from last session")
    : "Not enough data";

  const batchData = Array.from(new Set(students.map((student) => student.batch).filter(Boolean))).map((batch) => {
    const rows = students.filter((student) => student.batch === batch);
    const hiredCount = rows.filter((student) => student.hired).length;
    return { batch, placement: rows.length ? Math.round((hiredCount / rows.length) * 100) : 0, total: rows.length, hired: hiredCount };
  });

  return {
    total,
    totalMenteesSubtitle,
    hiredThisMonth,
    hiredPercentage: total ? Math.round((hiredThisMonth / total) * 100) : 0,
    highRisk,
    highRiskSubtitle,
    avgAttendance,
    avgAttendanceSubtitle,
    activeThisWeek,
    inactiveCount: filteredStudents.length - activeThisWeek,
    stageData,
    attendanceTrend,
    batchData,
  };
}

export default function MentorDashboardPage() {
  const { students, attendance, riskScores, progressLogs, importHistory, alerts, isLoading } = usePlacementStore();
  const [importOpen, setImportOpen] = useState(false);
  const [activeBatch, setActiveBatch] = useState<string>("all");

  const batches = useMemo(() => Array.from(new Set(students.map((s) => s.batch).filter(Boolean))).sort(), [students]);
  const filteredStudents = useMemo(() => activeBatch === "all" ? students : students.filter(s => s.batch === activeBatch), [students, activeBatch]);
  const metrics = useMemo(() => computeDashboardMetrics(students, filteredStudents, riskScores, attendance), [students, filteredStudents, riskScores, attendance]);
  const riskTrend = useMemo(() => buildRiskTrend(filteredStudents, attendance, progressLogs), [filteredStudents, attendance, progressLogs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MentorDashboardHeader
        totalMentees={metrics.total}
        batches={batches}
        activeBatch={activeBatch}
        onActiveBatchChange={setActiveBatch}
        onImportClick={() => setImportOpen(true)}
      />

      <MentorStatsGrid {...metrics} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <StageDistributionCard stageData={metrics.stageData} totalFiltered={filteredStudents.length} />
          <AttendanceTrendCard attendanceTrend={metrics.attendanceTrend} avgAttendance={metrics.avgAttendance} />
          <RiskOverTimeCard riskTrend={riskTrend} />
          <BatchPerformanceCard batchData={metrics.batchData} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <MentorSmartNudges students={students} progressLogs={progressLogs} attendance={attendance} />
          <MentorActivityFeed alerts={alerts} students={students} importHistory={importHistory} />
        </div>
      </div>

      <UniversalExcelImport open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
