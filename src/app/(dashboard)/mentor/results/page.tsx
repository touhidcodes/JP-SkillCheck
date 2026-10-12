"use client";

import { useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Search,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCandidateReports, type CandidateReport } from "@/lib/interviews/results-store";

export default function MentorResultsPage() {
  const [reports, setReports] = useState<CandidateReport[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedReport, setSelectedReport] = useState<CandidateReport | null>(null);

  useEffect(() => {
    const data = getCandidateReports();
    setReports(data);
  }, []);

  const batches = Array.from(new Set(reports.map((r) => r.batch).filter(Boolean)));

  const filteredReports = reports.filter((report) => {
    const matchesEmail = report.candidateEmail.toLowerCase().includes(searchEmail.toLowerCase()) ||
      report.interviewTitle.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesBatch = selectedBatch === "all" || report.batch === selectedBatch;
    return matchesEmail && matchesBatch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 text-xs font-bold">
              Mentor Portal
            </Badge>
            <span className="text-xs text-muted-foreground">· Anti-Cheating & AI Assessment Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Student Interview Results & Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review completed student interview submissions, per-question breakdown, eye contact logs, and tab switch warnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-muted text-foreground border border-border text-xs px-3 py-1.5 font-bold">
            Total Reports: {filteredReports.length}
          </Badge>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by student email or interview title..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            className="pl-9 bg-background border-input text-foreground text-xs h-9 focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredReports.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl bg-muted/30 border border-border">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">No Interview Reports Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              Completed student interview reports will appear here automatically after evaluation.
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <Card
              key={report.id}
              className="border border-border/80 bg-card text-card-foreground shadow-sm hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              onClick={() => setSelectedReport(report)}
            >
              <CardHeader className="p-4 pb-3 border-b border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20 text-[10px] font-bold mb-1">
                      {report.batch || "Batch Session"}
                    </Badge>
                    <CardTitle className="text-base font-bold truncate leading-tight text-foreground">
                      {report.interviewTitle}
                    </CardTitle>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{report.score}</span>
                    <span className="text-[10px] text-muted-foreground block">/ 100</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Student:
                  </span>
                  <span className="text-foreground font-bold truncate max-w-[180px]">
                    {report.candidateEmail}
                  </span>
                </div>

                {/* Behavioral & Anti-Cheating Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/50 border border-border text-[11px]">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1">
                      <Eye className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Eye Contact
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-300 font-semibold truncate block mt-0.5">
                      {report.eyeContactScore}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-muted/50 border border-border text-[11px]">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-500" /> Tab Switches
                    </span>
                    <span className={`font-semibold truncate block mt-0.5 ${report.tabSwitchCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {report.tabSwitchCount === 0 ? "0 (Clean)" : `${report.tabSwitchCount} Violation(s)`}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  <strong className="text-foreground">Summary: </strong>{report.summary}
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="w-3 h-3 text-muted-foreground" /> {new Date(report.completedAt).toLocaleDateString()}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 hover:underline">
                    View Full Report <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* DETAILED REPORT MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20 text-xs font-bold">
                    {selectedReport.batch}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Candidate Submission Report</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">{selectedReport.interviewTitle}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Student Email: <strong className="text-indigo-600 dark:text-indigo-300">{selectedReport.candidateEmail}</strong></p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{selectedReport.score}</span>
                  <span className="text-xs text-muted-foreground block font-semibold">/ 100 Overall</span>
                </div>
                <Button variant="ghost" onClick={() => setSelectedReport(null)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Behavioral & Anti-Cheating Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-1">
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Eye Contact Score
                </span>
                <span className="text-emerald-600 dark:text-emerald-300 font-bold text-sm">{selectedReport.eyeContactScore}</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Body & Head Position
                </span>
                <span className="text-indigo-600 dark:text-indigo-300 font-bold text-sm">{selectedReport.movementScore}</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Tab Switch Violations
                </span>
                <span className={`font-bold text-sm ${selectedReport.tabSwitchCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {selectedReport.tabSwitchCount === 0 ? "0 Violations (Clean)" : `${selectedReport.tabSwitchCount} Tab Switch(es)`}
                </span>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border leading-relaxed text-xs text-muted-foreground space-y-1">
              <span className="font-bold text-foreground uppercase text-[10px] tracking-wider block">AI Evaluation Summary</span>
              <p>{selectedReport.summary}</p>
            </div>

            {/* Question by Question Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Question-by-Question Detailed Breakdown
              </h3>

              <div className="space-y-3">
                {selectedReport.questionBreakdown.map((q, idx) => (
                  <div key={q.questionId || idx} className="p-4 rounded-xl bg-muted/40 border border-border space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                          Q{idx + 1}
                        </Badge>
                        <h4 className="text-xs font-bold text-foreground">{q.prompt}</h4>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-bold shrink-0 ${
                          q.status === "Answered"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20"
                            : q.status === "Partially Answered"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20"
                        }`}
                      >
                        {q.status} · {q.score} pts
                      </Badge>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border text-xs space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase block">Student Answer:</span>
                      <p className="text-foreground italic leading-relaxed">
                        {q.candidateAnswer ? `"${q.candidateAnswer}"` : <span className="text-amber-600 dark:text-amber-400 font-semibold">[No answer provided / Inactivity silence]</span>}
                      </p>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <strong className="text-indigo-600 dark:text-indigo-400">AI Feedback:</strong> {q.feedback}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 space-y-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Key Strengths
                </span>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  {selectedReport.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/20 space-y-1.5">
                <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Areas for Improvement
                </span>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  {selectedReport.improvements.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedReport(null)} className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white">
                Close Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

