"use client";

import React, { useState } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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
import { LineChartIcon, BarChart3, TrendingUp, Users } from "lucide-react";

interface TrendData {
  date: string;
  rate: number;
  present: number;
  absent: number;
}

interface BatchData {
  batch: string;
  rate: number;
  totalLogs: number;
}

interface AttendanceAnalyticsProps {
  trendData: TrendData[];
  batchData: BatchData[];
}

export function AttendanceAnalytics({
  trendData,
  batchData,
}: AttendanceAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<"trend" | "batches">("trend");

  return (
    <Card className="border border-border/50 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Attendance Insights
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Analyze historical session trends and batch performance.
          </CardDescription>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-2 w-full sm:w-[240px] h-9">
            <TabsTrigger value="trend" className="text-xs flex items-center gap-1.5">
              <LineChartIcon className="w-3.5 h-3.5" />
              Trend Line
            </TabsTrigger>
            <TabsTrigger value="batches" className="text-xs flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Batch Rates
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-6">
        <Tabs value={activeTab} className="space-y-0">
          <TabsContent value="trend" className="mt-0 outline-hidden">
            <div className="relative">
              <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  Last 8 Sessions
                </span>
                <MetricPopover
                  title="Session Trend Insights"
                  description="Displays the aggregate attendance percentage across successive sessions to observe overall engagement patterns."
                  metrics="Attendance logs grouped by session date."
                  calculation="Attendance % = (Present Students / Total Logged Students) * 100"
                  importance="Upward slopes reflect successful student outreach. Slumps below 80% indicate cohorts requiring critical academic review."
                  side="left"
                  align="start"
                />
              </div>

              {trendData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                  <LineChartIcon className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No historic attendance records to plot</p>
                </div>
              ) : (
                <div className="h-[240px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        className="stroke-muted/30"
                      />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-[10px] font-medium text-muted-foreground"
                        tickFormatter={(str) => {
                          try {
                            const d = new Date(str);
                            return d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          } catch {
                            return str;
                          }
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-[10px] font-medium text-muted-foreground"
                        tickFormatter={(val) => `${val}%`}
                      />
                      <RechartsTooltip
                        cursor={{ stroke: "rgba(99, 102, 241, 0.15)", strokeWidth: 2 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as TrendData;
                            return (
                              <div className="bg-card/95 border border-border/80 p-3 rounded-xl shadow-md text-xs font-medium space-y-1.5 min-w-[140px] backdrop-blur-md">
                                <p className="text-muted-foreground text-[10px] font-bold">
                                  {new Date(data.date).toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                                <div className="flex items-center justify-between text-indigo-500 font-bold border-b pb-1">
                                  <span>Attendance</span>
                                  <span>{data.rate}%</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground pt-0.5">
                                  <div>Present: <span className="text-emerald-500 font-semibold">{data.present}</span></div>
                                  <div>Absent: <span className="text-rose-500 font-semibold">{data.absent}</span></div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ r: 4, stroke: "#6366f1", strokeWidth: 2, fill: "#fff" }}
                        activeDot={{ r: 6, stroke: "#6366f1", strokeWidth: 2, fill: "#6366f1" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="batches" className="mt-0 outline-hidden">
            <div className="relative">
              <div className="absolute top-0 right-0 z-10 flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  Batch Breakdown
                </span>
                <MetricPopover
                  title="Batch Distribution Insights"
                  description="Compares the average attendance levels across distinct academic batches to locate underperforming groups."
                  metrics="Assigned student batches mapped to attendance records."
                  calculation="Batch Attendance Rate = (Total Present Logs in Batch / Total Logs in Batch) * 100"
                  importance="Pinpoints structural attendance gaps. Allows mentors to target cohort-wide intervention plans."
                  side="left"
                  align="start"
                />
              </div>

              {batchData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-dashed rounded-xl bg-muted/5">
                  <Users className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No cohort logs to calculate batch rates</p>
                </div>
              ) : (
                <div className="h-[240px] w-full pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={batchData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        className="stroke-muted/30"
                      />
                      <XAxis
                        dataKey="batch"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-[10px] font-medium text-muted-foreground"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        className="text-[10px] font-medium text-muted-foreground"
                        tickFormatter={(val) => `${val}%`}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as BatchData;
                            return (
                              <div className="bg-card/95 border border-border/80 p-3 rounded-xl shadow-md text-xs font-medium space-y-1 backdrop-blur-md">
                                <p className="text-foreground font-bold">{data.batch}</p>
                                <div className="flex items-center justify-between text-indigo-500 font-bold border-b pb-1">
                                  <span>Avg Rate</span>
                                  <span>{data.rate}%</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground pt-0.5">
                                  Total Log Entries: <span className="font-semibold">{data.totalLogs}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="rate"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={45}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
