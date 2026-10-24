"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video, BookOpen, ClipboardCheck, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCandidateReports } from "@/lib/interviews/results-store";

export default function MentorDashboardLandingPage() {
  const [interviewsCount, setInterviewsCount] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);

  useEffect(() => {
    const reports = getCandidateReports();
    setReportsCount(reports.length);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-800/40 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-400/40 text-indigo-200 bg-indigo-500/20 text-xs font-bold">
              SkillCheck Portal
            </Badge>
            <span className="text-xs text-indigo-200/80">· AI Video Interview System</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Mentor Video Interview Dashboard
          </h1>
          <p className="text-xs text-indigo-100/90 leading-relaxed">
            Create custom batch mock interviews, configure Google Sheet email whitelists, set time slot windows, and review AI assessment reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link href="/mentor/create-interview">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20">
              <Plus className="w-4 h-4 mr-1.5" /> Create New Interview
            </Button>
          </Link>
          <Link href="/mentor/results">
            <Button size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs font-bold backdrop-blur-sm">
              <ClipboardCheck className="w-4 h-4 mr-1.5 text-emerald-300" /> Student Results ({reportsCount})
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Card 1: Create Interview */}
        <Card className="border border-border/80 bg-card text-card-foreground hover:border-indigo-500/50 shadow-sm transition-all flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <Video className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-bold text-foreground">Create Video Interview</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Setup batch-wise mock interviews with mandatory camera, Google Sheet whitelists, and time slot windows.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Link href="/mentor/create-interview">
              <Button variant="secondary" className="w-full justify-between h-10 bg-muted hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold text-xs border border-border">
                Create Mock Session <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Card 2: Created Interviews */}
        <Card className="border border-border/80 bg-card text-card-foreground hover:border-purple-500/50 shadow-sm transition-all flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-foreground">Created Interviews</CardTitle>
              <Badge variant="outline" className="text-xs text-purple-600 dark:text-purple-300 border-purple-500/30">
                {interviewsCount} Active
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Copy shareable student links, view active time slots, and manage created interview sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Link href="/mentor/interviews">
              <Button variant="secondary" className="w-full justify-between h-10 bg-muted hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-600 dark:text-purple-300 font-bold text-xs border border-border">
                View Created Interviews <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Card 3: Student Results & Reports */}
        <Card className="border border-border/80 bg-card text-card-foreground hover:border-emerald-500/50 shadow-sm transition-all flex flex-col justify-between">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-foreground">Student Reports</CardTitle>
              <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-300 border-emerald-500/30">
                {reportsCount} Evaluated
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Review AI evaluation scores, per-question answers, eye contact logs, and tab switch warnings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Link href="/mentor/results">
              <Button variant="secondary" className="w-full justify-between h-10 bg-muted hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-300 font-bold text-xs border border-border">
                Inspect Student Reports <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

