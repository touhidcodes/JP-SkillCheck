"use client";

import React, { useState, useMemo } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricPopover } from "@/components/shared/metric-popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, AlertTriangle, ChevronDown, ChevronUp, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MentorTask } from "@/types";

interface TaskAnalyticsProps {
  tasks: MentorTask[];
  isLoading?: boolean;
}

export function TaskAnalytics({ tasks, isLoading = false }: TaskAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"workload" | "priority" | "types">("workload");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState<"all" | "7days" | "30days" | "90days">("all");

  // ── Time-Range filtering ──
  const filteredTasks = useMemo(() => {
    if (timeRange === "all") return tasks;

    const now = new Date();
    const threshold = new Date();
    if (timeRange === "7days") {
      threshold.setDate(now.getDate() - 7);
    } else if (timeRange === "30days") {
      threshold.setDate(now.getDate() - 30);
    } else if (timeRange === "90days") {
      threshold.setDate(now.getDate() - 90);
    }

    return tasks.filter((t) => {
      const dateStr = t.created_at || t.due_date;
      if (!dateStr) return true; // Keep task if no date is specified to avoid filtering out data
      const taskDate = new Date(dateStr);
      if (isNaN(taskDate.getTime())) return true;
      return taskDate >= threshold;
    });
  }, [tasks, timeRange]);

  // ── Workload Data (Pending tasks vs Completed tasks per student) ──
  const workloadData = useMemo(() => {
    const counts: Record<string, { name: string; pending: number; completed: number; total: number }> = {};
    
    filteredTasks.forEach((t) => {
      const name = t.student_name || "Personal";
      if (!counts[name]) {
        counts[name] = { name, pending: 0, completed: 0, total: 0 };
      }
      counts[name].total += 1;
      if (t.completed) {
        counts[name].completed += 1;
      } else {
        counts[name].pending += 1;
      }
    });

    return Object.values(counts)
      .filter((d) => d.total > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 8); // Top 8 students
  }, [filteredTasks]);

  // ── Priority Mix Data ──
  const priorityData = useMemo(() => {
    const priorityOrder = ["critical", "high", "medium", "low"];
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    
    filteredTasks.forEach((t) => {
      if (!t.completed && t.priority in counts) {
        counts[t.priority as keyof typeof counts] += 1;
      }
    });

    const totalActive = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return priorityOrder.map((p) => {
      const count = counts[p as keyof typeof counts];
      return {
        priority: p.charAt(0).toUpperCase() + p.slice(1),
        count,
        percentage: totalActive > 0 ? Math.round((count / totalActive) * 100) : 0,
        fill: p === "critical" ? "#ef4444" : p === "high" ? "#f59e0b" : p === "medium" ? "#3b82f6" : "#94a3b8",
      };
    });
  }, [filteredTasks]);

  const totalActivePriorities = useMemo(() => {
    return priorityData.reduce((sum, item) => sum + item.count, 0);
  }, [priorityData]);

  // ── Type breakdown data (Completed vs Pending by Type) ──
  const typeData = useMemo(() => {
    const types: Record<string, { type: string; completed: number; pending: number; total: number }> = {};
    const labelMap: Record<string, string> = {
      follow_up: "Follow Up",
      schedule_interview: "Interview",
      review_progress: "Review",
      risk_check: "Risk Check",
      update_student_data: "Update Data",
      other: "Other",
    };

    filteredTasks.forEach((t) => {
      const label = labelMap[t.task_type] || "Other";
      if (!types[label]) {
        types[label] = { type: label, completed: 0, pending: 0, total: 0 };
      }
      types[label].total += 1;
      if (t.completed) {
        types[label].completed += 1;
      } else {
        types[label].pending += 1;
      }
    });

    return Object.values(types).filter((d) => d.total > 0);
  }, [filteredTasks]);

  // Custom tooltips for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 border border-border/80 p-3 rounded-xl shadow-lg text-xs font-medium space-y-1.5 backdrop-blur-md">
          <p className="text-foreground font-bold">{label || payload[0].name}</p>
          <div className="space-y-1 border-t border-border/50 pt-1">
            {payload.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: item.color || item.fill }} />
                  {item.name}
                </span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-[280px] hidden sm:block" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-8" />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <div className="h-[220px] w-full flex items-end gap-3 pt-6 px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <Skeleton className="w-full rounded-t-lg" style={{ height: `${20 + i * 15}%` }} />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden rounded-2xl transition-all duration-300">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50 pr-6">
        <div className="flex-1">
          <CardTitle className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
            Task Analytics & Insights
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Monitor mentor workload, task priorities, and completion distributions.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCollapsed && (
            <>
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as any)}
                className="hidden sm:block"
              >
                <TabsList className="grid grid-cols-3 h-8 w-[300px] bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  <TabsTrigger value="workload" className="text-[11px] font-semibold py-1 rounded-md">
                    Workload
                  </TabsTrigger>
                  <TabsTrigger value="priority" className="text-[11px] font-semibold py-1 rounded-md">
                    Priority Mix
                  </TabsTrigger>
                  <TabsTrigger value="types" className="text-[11px] font-semibold py-1 rounded-md">
                    Task Types
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Select
                value={timeRange}
                onValueChange={(value) => setTimeRange(value as any)}
              >
                <SelectTrigger className="h-8 w-[120px] text-[11px] bg-white dark:bg-slate-950 border-border/60 rounded-lg focus:ring-1">
                  <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent className="rounded-lg shadow-md border-border/60">
                  <SelectItem value="all" className="rounded-md text-[11px] font-semibold">All Time</SelectItem>
                  <SelectItem value="7days" className="rounded-md text-[11px] font-semibold">Last 7 Days</SelectItem>
                  <SelectItem value="30days" className="rounded-md text-[11px] font-semibold">Last 30 Days</SelectItem>
                  <SelectItem value="90days" className="rounded-md text-[11px] font-semibold">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100 rounded-lg"
            aria-label={isCollapsed ? "Expand Analytics" : "Collapse Analytics"}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-6">
          {/* Mobile Tabs selector */}
          <div className="sm:hidden mb-4">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-3 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <TabsTrigger value="workload" className="text-[11px] font-semibold py-1 rounded-md">Workload</TabsTrigger>
                <TabsTrigger value="priority" className="text-[11px] font-semibold py-1 rounded-md">Priority</TabsTrigger>
                <TabsTrigger value="types" className="text-[11px] font-semibold py-1 rounded-md">Types</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={activeTab} className="space-y-0">
            {/* ── Tab: Workload ── */}
            <TabsContent value="workload" className="mt-0 outline-hidden">
              <div className="relative">
                <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Top Mentees
                  </span>
                  <MetricPopover
                    title="Mentee Workload"
                    description="Displays the number of pending and completed tasks assigned to individual mentees to assist in balancing guidance effort."
                    metrics="Active and completed tasks grouped by student name."
                    calculation="Pending & Completed Tasks Count per Mentee"
                    importance="Prevents overloading specific students. Highlights active mentees requiring higher touch engagement."
                    side="left"
                    align="start"
                  />
                </div>

                {workloadData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                    <Users className="w-7 h-7 mb-2 opacity-40 text-indigo-500" />
                    <p className="text-xs font-semibold">No student task assignments found</p>
                  </div>
                ) : (
                  <div className="h-[220px] w-full pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={workloadData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="3 3"
                          className="stroke-muted/30"
                        />
                        <XAxis type="number" tickLine={false} axisLine={false} className="text-[10px] font-semibold text-muted-foreground" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          className="text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                          width={120}
                          interval={0}
                          tickFormatter={(val) => (val.length > 18 ? `${val.substring(0, 16)}...` : val)}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                          content={<CustomTooltip />}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingBottom: 10 }} />
                        <Bar
                          dataKey="completed"
                          name="Completed"
                          stackId="a"
                          fill="#10b981"
                          maxBarSize={15}
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending"
                          stackId="a"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={15}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Priority Mix ── */}
            <TabsContent value="priority" className="mt-0 outline-hidden">
              <div className="relative">
                <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Unresolved Priority
                  </span>
                  <MetricPopover
                    title="Priority Mix"
                    description="Analyzes the severity distribution of all unresolved pending tasks assigned to mentees."
                    metrics="Uncompleted tasks segmented by priority tag."
                    calculation="Count of tasks WHERE status != 'completed' GROUP BY priority"
                    importance="Enables you to prioritize critical blocker actions first before addressing low-priority checks."
                    side="left"
                    align="start"
                  />
                </div>

                {totalActivePriorities === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                    <AlertTriangle className="w-7 h-7 mb-2 opacity-40 text-amber-500" />
                    <p className="text-xs font-semibold">All priority tasks resolved!</p>
                  </div>
                ) : (
                  <div className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* Donut Chart */}
                      <div className="h-[200px] relative flex justify-center items-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={priorityData.filter((d) => d.count > 0)}
                              dataKey="count"
                              nameKey="priority"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={3}
                            >
                              {priorityData.filter((d) => d.count > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-extrabold tracking-tight text-foreground">
                            {totalActivePriorities}
                          </span>
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                            Active
                          </span>
                        </div>
                      </div>
                      
                      {/* Modern Legend Grid */}
                      <div className="grid grid-cols-2 gap-3 px-4">
                        {priorityData.map((item) => (
                          <div
                            key={item.priority}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-border/30 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.fill }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-foreground truncate">
                                {item.priority}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-semibold">
                                {item.count} tasks ({item.percentage}%)
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab: Task Types ── */}
            <TabsContent value="types" className="mt-0 outline-hidden">
              <div className="relative">
                <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                  <span className="text-[9px] font-bold text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Task Category
                  </span>
                  <MetricPopover
                    title="Task Type Completion"
                    description="Compares completed vs pending tasks for each action category type (Follow Up, Interview, Review, Risk Check, etc.)."
                    metrics="Tasks categorized by type and completion status."
                    calculation="Completed vs. Pending counts grouped by task_type"
                    importance="Identifies what categories of work are moving swiftly vs. which categories are backing up."
                    side="left"
                    align="start"
                  />
                </div>

                {typeData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                    <FileText className="w-7 h-7 mb-2 opacity-40 text-indigo-500" />
                    <p className="text-xs font-semibold">No tasks found for the selected range</p>
                  </div>
                ) : (
                  <div className="h-[220px] w-full pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={typeData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          strokeDasharray="3 3"
                          className="stroke-muted/30"
                        />
                        <XAxis
                          dataKey="type"
                          tickLine={false}
                          axisLine={false}
                          className="text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          className="text-[10px] font-semibold text-muted-foreground"
                          tickMargin={10}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "rgba(0, 0, 0, 0.02)" }}
                          content={<CustomTooltip />}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, fontWeight: 600, paddingBottom: 10 }} />
                        <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" maxBarSize={20} />
                        <Bar dataKey="pending" name="Pending" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
