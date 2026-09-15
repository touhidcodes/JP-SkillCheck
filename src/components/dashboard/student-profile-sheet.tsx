'use client';

import React, { useMemo, useState } from 'react';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { 
  Building2, CalendarDays, Clock, FileText, 
  AlertTriangle, BookOpen, CheckCircle2,
  Mail, Phone, Calendar as CalendarIcon,
  X as XIcon, Activity, Target, ShieldAlert, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { StageHistoryTab } from '@/components/dashboard/stage-history-tab';
import { AttendanceTab } from '@/components/dashboard/attendance-tab';

import type { Student } from '@/types';
import { PROJECT_NAMES } from '@/types';
import { usePlacementStore } from '@/lib/placement/store';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LogProgressDialog } from './dialogs/log-progress-dialog';
import { CreateTaskDialog } from '@/components/mentor/tasks/create-task-dialog';

const STAGE_COLORS: Record<string, string> = {
  learning: 'bg-indigo-50/70 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 font-bold',
  applying: 'bg-blue-50/70 text-blue-700 border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 font-bold',
  interviewing: 'bg-amber-50/70 text-amber-800 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-455 dark:border-amber-900/30 font-bold',
  offer_pending: 'bg-purple-50/70 text-purple-700 border-purple-200/60 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30 font-bold',
  placed: 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 font-bold',
  hired: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30 font-bold',
};

const RISK_COLORS: Record<string, string> = {
  safe: 'bg-emerald-55 text-emerald-700 border-emerald-200/65 font-black uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full',
  medium: 'bg-amber-55 text-amber-750 border-amber-200/65 font-black uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full',
  high: 'bg-red-55 text-red-700 border-red-200/65 font-black uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full',
};

interface StudentProfileSheetProps {
  student: Student | null;
  onClose: () => void;
  initialTab?: string;
}

export function StudentProfileSheet({ student, onClose, initialTab = 'overview' }: StudentProfileSheetProps) {
  const { attendance, progressLogs, riskScores, tasks, optimisticStudentUpdate } = usePlacementStore();
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  React.useEffect(() => {
    if (student) setActiveTab(initialTab);
  }, [student, initialTab]);
  
  const studentAttendance = useMemo(() => attendance.filter(a => a.student_id === student?.id), [attendance, student?.id]);
  const studentProgress = useMemo(() => progressLogs.filter(p => p.student_id === student?.id), [progressLogs, student?.id]);
  const studentRisk = useMemo(() => riskScores.find(r => r.student_id === student?.id), [riskScores, student?.id]);
  const studentTasks = useMemo(() => tasks.filter(t => t.student_id === student?.id), [tasks, student?.id]);

  if (!student) return null;

  const handleUpdateField = async (field: keyof Student, value: unknown) => {
    try {
      await optimisticStudentUpdate(student.id, { [field]: value });
    } catch {
      // handled in store
    }
  };

  return (
    <Sheet open={!!student} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showCloseButton={false} className="w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl p-0 flex flex-col bg-slate-50 border-l border-border/80 shadow-2xl">
        
        {/* Header Block */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950 px-6 py-7 shrink-0 flex flex-col gap-4 text-white">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start justify-between z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  {student.name}
                </SheetTitle>
                <div className="flex items-center gap-1.5 ml-1">
                  {student.hired && <Badge className="bg-green-600 hover:bg-green-600 text-white font-extrabold px-2.5 py-0.5 rounded-full border border-green-500 text-[10px] uppercase">Hired</Badge>}
                  {student.terminated && <Badge variant="destructive" className="font-extrabold px-2.5 py-0.5 rounded-full text-[10px] uppercase">Terminated</Badge>}
                  <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full text-[10px] uppercase border", STAGE_COLORS[student.stage])}>
                    {student.stage.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-400 text-xs font-medium">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-purple-400" /> {student.student_email || 'No email'}</span>
                {student.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-purple-400" /> {student.phone}</span>}
                <span className="flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5 text-purple-400" /> Batch: {student.batch}</span>
              </SheetDescription>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Select value={student.stage} onValueChange={(v) => handleUpdateField('stage', v)}>
                <SelectTrigger className="w-[145px] h-10 bg-slate-800/80 border-slate-750 text-white rounded-xl focus:ring-1 focus:ring-purple-500 font-semibold text-xs">
                  <SelectValue placeholder="Update Stage" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-md border-border/60">
                  <SelectItem value="learning" className="rounded-lg">Learning</SelectItem>
                  <SelectItem value="applying" className="rounded-lg">Applying</SelectItem>
                  <SelectItem value="interviewing" className="rounded-lg">Interviewing</SelectItem>
                  <SelectItem value="offer_pending" className="rounded-lg">Offer Pending</SelectItem>
                  <SelectItem value="placed" className="rounded-lg">Placed</SelectItem>
                  <SelectItem value="hired" className="rounded-lg">Hired</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 border border-slate-800/80 bg-slate-800/40 text-slate-300 hover:bg-slate-800 hover:text-white rounded-xl transition-all shadow-sm"
                onClick={onClose}
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2 z-10">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Risk Profile</p>
                <span className={RISK_COLORS[studentRisk?.level || 'safe']}>
                  {studentRisk?.level || 'SAFE'}
                </span>
              </div>
              <ShieldAlert className="w-5 h-5 text-purple-400 opacity-60" />
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Last Active</p>
                <p className="text-xs font-bold text-slate-100">
                  {student.last_activity_date ? formatDistanceToNow(new Date(student.last_activity_date), { addSuffix: true }) : 'Never'}
                </p>
              </div>
              <Clock className="w-5 h-5 text-purple-400 opacity-60" />
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Interviews</p>
                <p className="text-sm font-black text-slate-100">{studentProgress.filter(p => p.log_type === 'Interview Call').length} logged</p>
              </div>
              <Building2 className="w-5 h-5 text-purple-400 opacity-60" />
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Attendance (30d)</p>
                <p className="text-sm font-black text-slate-100">
                  {studentAttendance.slice(-30).filter(a => a.present).length} / {studentAttendance.slice(-30).length}
                </p>
              </div>
              <BookOpen className="w-5 h-5 text-purple-400 opacity-60" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b bg-white shrink-0 overflow-x-auto scrollbar-none shadow-xs">
            <TabsList className="bg-transparent h-14 p-0 space-x-6 flex w-max">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="timeline" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Stage Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="attendance" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Attendance & Activity
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Progress Logs
              </TabsTrigger>
              <TabsTrigger 
                value="risk" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Risk Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="tasks" 
                className="data-[state=active]:border-b-2 data-[state=active]:border-purple-650 rounded-none h-full px-2 data-[state=active]:shadow-none text-slate-500 data-[state=active]:text-slate-950 font-bold text-xs tracking-wider transition-all uppercase"
              >
                Follow-up Tasks
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Main Area Scroll */}
          <ScrollArea className="flex-1 p-6">
            
            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="m-0 space-y-6 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                  <CardHeader className="pb-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      Placement Profiling
                    </CardTitle>
                    <CardDescription className="text-xs">Adjust basic placement targets and indicators.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-650 uppercase tracking-widest">Target Project</label>
                        <Select value={student.project || 'none'} onValueChange={(v) => handleUpdateField('project', v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-10 text-xs rounded-xl border-border/50 bg-slate-50/50"><SelectValue placeholder="Set Project" /></SelectTrigger>
                          <SelectContent className="rounded-xl shadow-md border-border/60">
                            <SelectItem value="none" className="rounded-lg">No Project</SelectItem>
                            {PROJECT_NAMES.map(p => <SelectItem key={p} value={p} className="rounded-lg">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-650 uppercase tracking-widest">Preferred Job Focus</label>
                        <Select value={student.job_focus || 'none'} onValueChange={(v) => handleUpdateField('job_focus', v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-10 text-xs rounded-xl border-border/50 bg-slate-50/50"><SelectValue placeholder="Set Focus" /></SelectTrigger>
                          <SelectContent className="rounded-xl shadow-md border-border/60">
                            <SelectItem value="none" className="rounded-lg">No Preference</SelectItem>
                            <SelectItem value="remote" className="rounded-lg">Remote</SelectItem>
                            <SelectItem value="onsite" className="rounded-lg">Onsite</SelectItem>
                            <SelectItem value="hybrid" className="rounded-lg">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-650 uppercase tracking-widest">Experience Level</label>
                        <Select value={student.experience || 'none'} onValueChange={(v) => handleUpdateField('experience', v === 'none' ? '' : v)}>
                          <SelectTrigger className="h-10 text-xs rounded-xl border-border/50 bg-slate-50/50"><SelectValue placeholder="Set Experience" /></SelectTrigger>
                          <SelectContent className="rounded-xl shadow-md border-border/60">
                            <SelectItem value="none" className="rounded-lg">Unknown</SelectItem>
                            <SelectItem value="fresher" className="rounded-lg">Fresher</SelectItem>
                            <SelectItem value="experienced" className="rounded-lg">Experienced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-650 uppercase tracking-widest block">Task Performance Rate</label>
                        <div className="flex items-center gap-3 h-10 px-3 bg-purple-50/50 border border-purple-100/60 rounded-xl">
                          <Award className="w-4 h-4 text-purple-650" />
                          <span className="font-extrabold text-sm text-purple-750">{student.assignment_completion_pct || 0}% Complete</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
 
                <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                  <CardHeader className="pb-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      Mentor Performance Log Notes
                    </CardTitle>
                    <CardDescription className="text-xs">Internal annotations visible only to mentors/managers.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <textarea 
                      className="w-full h-[140px] p-4 text-sm rounded-2xl border border-slate-200/60 bg-slate-50/50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-650 focus-visible:border-purple-650 transition-all resize-none"
                      placeholder="Add internal performance notes, strengths, and mentorship focuses..."
                      defaultValue={student.notes || ''}
                      onBlur={(e) => {
                        if (e.target.value !== student.notes) {
                          handleUpdateField('notes', e.target.value);
                          toast.success('Internal notes updated successfully');
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* STAGE HISTORY TAB */}
            <TabsContent value="timeline" className="m-0 animate-in fade-in-50 duration-200">
              <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                <CardContent className="pt-6">
                  <StageHistoryTab studentId={student.id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ATTENDANCE TAB */}
            <TabsContent value="attendance" className="m-0 space-y-6 animate-in fade-in-50 duration-200">
              <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                <CardContent className="pt-6">
                  <AttendanceTab student={student} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* PROGRESS LOGS TAB */}
            <TabsContent value="logs" className="m-0 animate-in fade-in-50 duration-200">
               <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <CardTitle className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Interviews & Applications Logs
                    </CardTitle>
                    <CardDescription className="text-xs">Comprehensive event history of recruiting steps.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsLogDialogOpen(true)}
                    className="font-bold rounded-xl h-9 border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 text-xs text-slate-700"
                  >
                    + Log Event
                  </Button>
                </CardHeader>
                <CardContent className="pt-5">
                  {studentProgress.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium">No progress events have been logged for this student.</div>
                  ) : (
                    <div className="space-y-4">
                      {studentProgress.sort((a,b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).map(log => {
                        const isInterview = log.log_type.includes('Interview') || log.log_type === 'Interview Call';
                        return (
                          <div key={log.id} className="flex gap-4 p-5 rounded-2xl border border-slate-200/50 bg-white hover:border-slate-300 transition-all hover:shadow-xs">
                            <div className="mt-0.5">
                              <div className={cn("p-2 rounded-xl flex items-center justify-center", isInterview ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600")}>
                                {isInterview ? <Building2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-extrabold text-sm text-slate-900">{log.log_type}</h4>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{format(new Date(log.logged_at), 'MMM d, yyyy')}</span>
                              </div>
                              <p className="text-xs font-semibold text-slate-650 mt-1 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" /> {log.company_name}
                              </p>
                              {log.scheduled_date && (
                                <p className="text-[10px] font-bold text-slate-500 mt-1 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 w-fit flex items-center gap-1.5">
                                  <CalendarIcon className="w-3 h-3 text-purple-600" />
                                  Scheduled: {log.scheduled_date} {log.scheduled_time && `@ ${log.scheduled_time}`}
                                </p>
                              )}
                              {log.note && <p className="text-xs text-slate-600 mt-3 pl-3 border-l-2 border-slate-250 italic leading-relaxed">{log.note}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* RISK ANALYSIS TAB */}
            <TabsContent value="risk" className="m-0 space-y-6 animate-in fade-in-50 duration-200">
              {studentRisk ? (
                <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                  <CardHeader className="pb-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-purple-600" />
                        Risk Metrics Profile
                      </span>
                      <span className={RISK_COLORS[studentRisk.level]}>
                        {studentRisk.level.toUpperCase()} (Score: {studentRisk.score.toFixed(1)}/10)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-5">
                    
                    {/* Linear Gauge */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Risk Threat Level</span>
                        <span>{studentRisk.score.toFixed(1)} / 10.0</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            studentRisk.level === 'high' ? "bg-red-550" : studentRisk.level === 'medium' ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${studentRisk.score * 10}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black text-slate-650 uppercase tracking-wider mb-2.5">Critical Risk Threat Factor</h4>
                      <div className="p-4 bg-red-50/70 text-red-800 rounded-2xl border border-red-100/60 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-650 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold leading-normal">{studentRisk.top_factor}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[11px] font-black text-slate-650 uppercase tracking-wider mb-2.5">Detailed Factor Threat Levels</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Object.entries(studentRisk.factors).map(([key, value]) => {
                          const val = value * 10;
                          return (
                            <div key={key} className="flex justify-between items-center p-3.5 rounded-2xl bg-slate-50/50 border border-slate-200/50 text-xs">
                              <span className="capitalize font-bold text-slate-700">{key.replace('_', ' ')}</span>
                              <span className={cn("font-black text-sm", val > 5 ? "text-red-600" : "text-emerald-650")}>
                                {val.toFixed(1)} / 10.0
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black text-slate-650 uppercase tracking-wider mb-2.5">Recommended Mentorship Intervention</h4>
                      <div className="p-4 bg-purple-50/50 text-purple-800 rounded-2xl border border-purple-100/60 text-xs font-bold leading-relaxed">
                        {studentRisk.recommended_action}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm font-medium border border-dashed rounded-2xl bg-slate-50/50 p-6">
                  No advanced automated risk evaluation available for this student.
                </div>
              )}
            </TabsContent>

            {/* MENTOR TASKS TAB */}
            <TabsContent value="tasks" className="m-0 animate-in fade-in-50 duration-200">
               <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <CardTitle className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      Assigned Mentor Tasks
                    </CardTitle>
                    <CardDescription className="text-xs">Track execution checklist and task priority flags.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsTaskDialogOpen(true)}
                    className="font-bold rounded-xl h-9 border-slate-200 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-1.5 text-xs text-slate-700"
                  >
                    + Assign Task
                  </Button>
                </CardHeader>
                <CardContent className="pt-5">
                  {studentTasks.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm font-medium">No tasks or action checklist items assigned.</div>
                  ) : (
                    <div className="space-y-3">
                      {studentTasks.map(task => {
                        const isOverdue = !task.completed && differenceInDays(new Date(task.due_date), new Date()) < 0;
                        return (
                          <div key={task.id} className="flex items-start justify-between p-4 rounded-2xl border border-slate-200/60 bg-white hover:border-slate-300 transition-all hover:shadow-xs">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                                )}
                              </div>
                              <div>
                                <p className={cn("text-xs font-extrabold text-slate-850", task.completed && "line-through text-slate-400")}>{task.title}</p>
                                <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                                  <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
                                  Due Date: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                  {isOverdue && <span className="text-red-600 font-extrabold text-[9px] uppercase bg-red-50 border border-red-100 rounded-md px-1.5 py-0.5 ml-1">Overdue</span>}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {task.priority && (
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                  task.priority === 'critical' ? "bg-red-50 text-red-700 border-red-200/60" :
                                  task.priority === 'high' ? "bg-amber-50 text-amber-800 border-amber-200/60" :
                                  task.priority === 'medium' ? "bg-purple-50 text-purple-750 border-purple-200/60" :
                                  "bg-slate-100 text-slate-600 border-slate-200"
                                )}>
                                  {task.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>

      <LogProgressDialog 
        student={student} 
        open={isLogDialogOpen} 
        onOpenChange={setIsLogDialogOpen} 
      />

      <CreateTaskDialog
        students={student ? [{ id: student.id, name: student.name }] : []}
        defaultStudentId={student?.id}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSuccess={() => setIsTaskDialogOpen(false)}
      />
    </Sheet>
  );
}
