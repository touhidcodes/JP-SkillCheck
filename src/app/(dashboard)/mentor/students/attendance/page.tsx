"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  FileText,
  Filter,
  Keyboard,
  Mic,
  PanelLeft,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Square,
  UserCheck,
  Users,
  X,
  HelpCircle,
  Columns,
  Activity,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CreateFormButton } from "@/components/attendance/CreateFormButton";
import { ActiveFormsDrawer } from "@/components/attendance/ActiveFormsDrawer";
import { AttendanceAnalytics } from "@/components/attendance/AttendanceAnalytics";
import { AttendanceImportDialog } from "@/components/attendance/AttendanceImportDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAttendanceForms } from "@/hooks/use-attendance-forms";
import { MoreHorizontal, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";

type AttendanceMode = "session" | "daily";
type AttendancePeriod = "full_day" | "morning" | "afternoon";
type AttendanceKind = "present" | "absent" | "excused" | "unmarked";
type SortOrder = "name" | "batch" | "last_attendance" | "likely_absent";

interface Student {
  id: string;
  name: string;
  batch: string;
  mentor_email: string;
  risk_status?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  present: boolean;
  logged_by: string;
  session_label: string;
  excuse: string;
  excuse_note: string;
  session_id?: string;
  mode?: AttendanceMode;
  period?: AttendancePeriod;
  duration_minutes?: string;
  topic_tags?: string;
  source?: string;
  attendance_note?: string;
  status_label?: string;
  status_color?: string;
  status_emoji?: string;
  updated_at?: string;
}

interface StatusOption {
  id: string;
  label: string;
  kind: Exclude<AttendanceKind, "unmarked">;
  emoji: string;
  color: string;
  visible: boolean;
  modes: AttendanceMode[];
}

interface AttendancePayload {
  student_id: string;
  date: string;
  present: boolean;
  session_label: string;
  excuse?: "exam" | "sick" | "personal" | "other" | "";
  excuse_note?: string;
  session_id: string;
  mode: AttendanceMode;
  period: AttendancePeriod;
  duration_minutes?: number;
  topic_tags?: string;
  source:
    | "manual"
    | "bulk"
    | "auto_check_in"
    | "offline_sync"
    | "keyboard"
    | "voice"
    | "student_form";
  attendance_note?: string;
  status_label?: string;
  status_color?: string;
  status_emoji?: string;
  notify_student?: boolean;
}

interface SpeechRecognitionLike {
  lang: string;
  start: () => void;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onerror: (() => void) | null;
}

const PAGE_SIZE = 50;
const OFFLINE_QUEUE_KEY = "attendance-offline-queue-v1";

const DEFAULT_STATUSES: StatusOption[] = [
  {
    id: "present",
    label: "Present",
    kind: "present",
    emoji: "✓",
    color: "emerald",
    visible: true,
    modes: ["session", "daily"],
  },
  {
    id: "absent",
    label: "Absent",
    kind: "absent",
    emoji: "×",
    color: "red",
    visible: true,
    modes: ["session", "daily"],
  },
  {
    id: "exam",
    label: "Exam",
    kind: "excused",
    emoji: "📝",
    color: "amber",
    visible: true,
    modes: ["daily"],
  },
  {
    id: "sick",
    label: "Sick",
    kind: "excused",
    emoji: "🤒",
    color: "rose",
    visible: true,
    modes: ["session", "daily"],
  },
  {
    id: "personal",
    label: "Excused",
    kind: "excused",
    emoji: "🏠",
    color: "blue",
    visible: true,
    modes: ["session", "daily"],
  },
  {
    id: "late",
    label: "Late",
    kind: "excused",
    emoji: "⏱",
    color: "violet",
    visible: false,
    modes: ["session", "daily"],
  },
  {
    id: "remote",
    label: "Remote",
    kind: "present",
    emoji: "💻",
    color: "cyan",
    visible: false,
    modes: ["session", "daily"],
  },
];

const STATUS_STYLES: Record<string, string> = {
  emerald:
    "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  red: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
  amber: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
  blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  violet: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
  slate: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-cyan-100 text-cyan-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function normalizeSessionName(
  mode: AttendanceMode,
  sessionName: string,
  period: AttendancePeriod,
) {
  if (sessionName.trim()) return sessionName.trim();
  if (mode === "daily")
    return period === "morning"
      ? "Daily Class - Morning"
      : period === "afternoon"
        ? "Daily Class - Afternoon"
        : "Daily Class";
  return "Mentor Session";
}

function statusFromRecord(record?: AttendanceRecord): AttendanceKind {
  if (!record) return "unmarked";
  if (record.present) return "present";
  if (record.excuse) return "excused";
  return "absent";
}

function excuseFromStatus(status: StatusOption): AttendancePayload["excuse"] {
  if (status.kind !== "excused") return "";
  if (["exam", "sick", "personal"].includes(status.id))
    return status.id as AttendancePayload["excuse"];
  return "other";
}

function batchTint(batch: string) {
  const tints = [
    "bg-cyan-50/35",
    "bg-violet-50/35",
    "bg-amber-50/35",
    "bg-emerald-50/35",
    "bg-rose-50/35",
  ];
  let hash = 0;
  for (let i = 0; i < batch.length; i++)
    hash = batch.charCodeAt(i) + ((hash << 5) - hash);
  return tints[Math.abs(hash) % tints.length];
}

function statusBadge(record?: AttendanceRecord) {
  const kind = statusFromRecord(record);
  if (kind === "unmarked")
    return (
      <Tooltip>
        <TooltipTrigger render={
          <Badge variant="outline" className="border-dashed text-muted-foreground cursor-help">
            Not marked
          </Badge>
        } />
        <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
          This student has not been marked for the current session.
        </TooltipContent>
      </Tooltip>
    );
  if (kind === "present")
    return (
      <Tooltip>
        <TooltipTrigger render={
          <Badge className="border bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 cursor-help">
            <Check className="w-3 h-3" />
            {record?.status_label || "Present"}
          </Badge>
        } />
        <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
          Student was marked present. Updates engagement logs.
        </TooltipContent>
      </Tooltip>
    );
  if (kind === "excused")
    return (
      <Tooltip>
        <TooltipTrigger render={
          <Badge className="border bg-amber-50 text-amber-700 border-amber-200 gap-1 cursor-help">
            <FileText className="w-3 h-3" />
            {record?.status_label || record?.excuse || "Excused"}
          </Badge>
        } />
        <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
          Excused absence: {record?.excuse_note || "No specific reason logged"}.
        </TooltipContent>
      </Tooltip>
    );
  return (
    <Tooltip>
      <TooltipTrigger render={
        <Badge className="border bg-red-50 text-red-700 border-red-200 gap-1 cursor-help">
          <X className="w-3 h-3" />
          Absent
        </Badge>
      } />
      <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
        Student was marked absent. Unexcused absence affects trailing attendance rate and risk score.
      </TooltipContent>
    </Tooltip>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = values.length ? values : [0, 0, 0, 0, 0];
  return (
    <div className="flex items-end gap-0.5 h-5" aria-hidden="true">
      {points.slice(-8).map((value, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-primary/50"
          style={{ height: `${Math.max(3, value * 18)}px` }}
        />
      ))}
    </div>
  );
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export default function MentorAttendancePage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AttendanceMode>("session");
  const [period, setPeriod] = useState<AttendancePeriod>("full_day");
  const [date, setDate] = useState(todayIso());
  const [sessionName, setSessionName] = useState("Afternoon Session");
  const [duration, setDuration] = useState(90);
  const [topicTags, setTopicTags] = useState("React, Placement Prep");
  const [batchFilter, setBatchFilter] = useState("all");
  const [defaultStatusId, setDefaultStatusId] = useState("unmarked");
  const [autoCloseMinutes, setAutoCloseMinutes] = useState(30);
  const [notifyStudents, setNotifyStudents] = useState(false);
  const [checkInEnabled, setCheckInEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AttendanceKind | "all">(
    "all",
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const [statuses, setStatuses] = useState<StatusOption[]>(DEFAULT_STATUSES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusIndex, setFocusIndex] = useState(0);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [activeFormsDrawerOpen, setActiveFormsDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<AttendancePayload[]>([]);
  const touchStartRef = useRef<Record<string, number>>({});

  const sessionLabel = normalizeSessionName(mode, sessionName, period);
  const sessionId = `${date}:${mode}:${period}:${sessionLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const todaysForms = useAttendanceForms(date);
  const activeFormExists =
    todaysForms.data?.data?.some(
      (f: { is_active: boolean; is_expired: boolean }) =>
        f.is_active && !f.is_expired,
    ) ?? false;

  const {
    data: attData,
    isLoading: attLoading,
    isFetching,
  } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: async () => {
      const res = await fetch("/api/attendance");
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json() as Promise<{ data: AttendanceRecord[] }>;
    },
    refetchInterval: activeFormExists ? 8_000 : false,
    refetchIntervalInBackground: false,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const res = await fetch("/api/students?limit=500");
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json() as Promise<{ data: Student[] }>;
    },
  });

  const records = useMemo(() => attData?.data ?? [], [attData?.data]);
  const allStudents = useMemo(
    () => studentsData?.data ?? [],
    [studentsData?.data],
  );
  const batches = useMemo(
    () =>
      Array.from(
        new Set(allStudents.map((s) => s.batch).filter(Boolean)),
      ).sort(),
    [allStudents],
  );

  const activeRecords = useMemo(
    () =>
      records.filter((record) => {
        const sameSession =
          (record.session_id ||
            `${record.date}:session:full_day:${record.session_label}`) ===
          sessionId;
        const legacyMatch =
          !record.session_id &&
          record.date === date &&
          record.session_label === sessionLabel;
        return sameSession || legacyMatch;
      }),
    [records, sessionId, date, sessionLabel],
  );

  const recordByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of activeRecords) map.set(record.student_id, record);
    return map;
  }, [activeRecords]);

  const prevRecordCount = usePrevious(activeRecords.length);

  useEffect(() => {
    if (
      prevRecordCount !== undefined &&
      activeRecords.length > prevRecordCount
    ) {
      const diff = activeRecords.length - prevRecordCount;
      toast.success(
        `${diff} new attendance ${diff === 1 ? "record" : "records"} submitted by students`,
      );
    }
  }, [activeRecords.length, prevRecordCount]);

  const studentStats = useMemo(() => {
    const map = new Map<
      string,
      {
        rate: number;
        excusedRecent: number;
        lastDate: string;
        trend: number[];
        likelyAbsent: number;
      }
    >();
    for (const student of allStudents) {
      const studentRecords = records
        .filter((record) => record.student_id === student.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const recent = studentRecords.slice(0, 10);
      const present = recent.filter((record) => record.present).length;
      const excusedRecent = recent.filter(
        (record) => !record.present && record.excuse,
      ).length;
      const absentRecent = recent.filter(
        (record) => !record.present && !record.excuse,
      ).length;
      map.set(student.id, {
        rate: recent.length ? Math.round((present / recent.length) * 100) : 0,
        excusedRecent,
        lastDate: recent[0]?.date || "",
        trend: recent
          .slice(0, 8)
          .reverse()
          .map((record) => (record.present ? 1 : record.excuse ? 0.6 : 0.1)),
        likelyAbsent:
          absentRecent * 2 +
          excusedRecent +
          (student.risk_status === "at_risk" ? 3 : 0),
      });
    }
    return map;
  }, [allStudents, records]);

  const summary = useMemo(() => {
    const present = activeRecords.filter((record) => record.present).length;
    const excused = activeRecords.filter(
      (record) => !record.present && record.excuse,
    ).length;
    const absent = activeRecords.filter(
      (record) => !record.present && !record.excuse,
    ).length;
    const scopedStudents =
      batchFilter === "all"
        ? allStudents
        : allStudents.filter((student) => student.batch === batchFilter);
    const unmarked = Math.max(
      0,
      scopedStudents.length -
        activeRecords.filter((record) =>
          scopedStudents.some((student) => student.id === record.student_id),
        ).length,
    );
    return {
      total: present + excused + absent,
      present,
      excused,
      absent,
      unmarked,
      scopedTotal: scopedStudents.length,
    };
  }, [activeRecords, allStudents, batchFilter]);

  const visibleStatuses = useMemo(
    () =>
      statuses.filter(
        (status) => status.visible && status.modes.includes(mode),
      ),
    [statuses, mode],
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allStudents.filter((student) => {
      const record = recordByStudent.get(student.id);
      const status = statusFromRecord(record);
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.batch.toLowerCase().includes(q) ||
        status.includes(q);
      const matchesBatch =
        batchFilter === "all" || student.batch === batchFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesBatch && matchesStatus;
    });
    return list.sort((a, b) => {
      if (sortOrder === "batch")
        return a.batch.localeCompare(b.batch) || a.name.localeCompare(b.name);
      if (sortOrder === "last_attendance")
        return (studentStats.get(b.id)?.lastDate || "").localeCompare(
          studentStats.get(a.id)?.lastDate || "",
        );
      if (sortOrder === "likely_absent")
        return (
          (studentStats.get(b.id)?.likelyAbsent || 0) -
          (studentStats.get(a.id)?.likelyAbsent || 0)
        );
      return a.name.localeCompare(b.name);
    });
  }, [
    allStudents,
    batchFilter,
    recordByStudent,
    search,
    sortOrder,
    statusFilter,
    studentStats,
  ]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const visibleStudents = paginatedStudents;
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;

  const selectedStudents = useMemo(
    () => filteredStudents.filter((student) => selectedIds.has(student.id)),
    [filteredStudents, selectedIds],
  );

  const trendData = useMemo(() => {
    const mentorStudentIds = new Set(allStudents.map((s) => s.id));
    const mentorRecords = records.filter((r) => mentorStudentIds.has(r.student_id));
    
    const grouped = mentorRecords.reduce((acc, curr) => {
      const dateKey = curr.date;
      if (!acc[dateKey]) acc[dateKey] = { total: 0, present: 0 };
      acc[dateKey].total += 1;
      if (curr.present) acc[dateKey].present += 1;
      return acc;
    }, {} as Record<string, { total: number; present: number }>);

    const sortedDates = Object.keys(grouped).sort();
    return sortedDates.slice(-8).map((d) => {
      const stats = grouped[d];
      const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      return {
        date: d,
        rate,
        present: stats.present,
        absent: stats.total - stats.present,
      };
    });
  }, [records, allStudents]);

  const batchData = useMemo(() => {
    const mentorStudentIds = new Set(allStudents.map((s) => s.id));
    const mentorRecords = records.filter((r) => mentorStudentIds.has(r.student_id));

    const batchStats = allStudents.reduce((acc, student) => {
      if (!student.batch) return acc;
      if (!acc[student.batch]) acc[student.batch] = { total: 0, present: 0 };
      
      const sRecords = mentorRecords.filter((r) => r.student_id === student.id);
      const sPresent = sRecords.filter((r) => r.present).length;
      
      acc[student.batch].total += sRecords.length;
      acc[student.batch].present += sPresent;
      return acc;
    }, {} as Record<string, { total: number; present: number }>);

    return Object.entries(batchStats).map(([batch, stats]) => ({
      batch,
      rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
      totalLogs: stats.total,
    }));
  }, [records, allStudents]);

  const mutation = useMutation({
    mutationFn: async (payload: AttendancePayload) => {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save attendance");
      }
      return res.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["attendance-all"] });
      const previous = queryClient.getQueryData<{ data: AttendanceRecord[] }>([
        "attendance-all",
      ]);
      queryClient.setQueryData<{ data: AttendanceRecord[] }>(
        ["attendance-all"],
        (old) => {
          const current = old?.data ?? [];
          const nextRecord: AttendanceRecord = {
            id: `optimistic-${payload.student_id}-${payload.period}`,
            student_id: payload.student_id,
            date: payload.date,
            present: payload.present,
            logged_by: "me",
            session_label: payload.session_label,
            excuse: payload.present ? "" : payload.excuse || "",
            excuse_note: payload.present ? "" : payload.excuse_note || "",
            session_id: payload.session_id,
            mode: payload.mode,
            period: payload.period,
            duration_minutes: String(payload.duration_minutes || ""),
            topic_tags: payload.topic_tags || "",
            source: payload.source,
            attendance_note: payload.attendance_note || "",
            status_label: payload.status_label || "",
            status_color: payload.status_color || "",
            status_emoji: payload.status_emoji || "",
            updated_at: new Date().toISOString(),
          };
          const filtered = current.filter(
            (record) =>
              !(
                record.student_id === payload.student_id &&
                (record.session_id || "") === payload.session_id &&
                (record.period || "full_day") === payload.period
              ),
          );
          return { data: [...filtered, nextRecord] };
        },
      );
      return { previous };
    },
    onError: (error, payload, context) => {
      if (error instanceof Error && error.message === "offline") {
        setOfflineQueue((prev) => [
          ...prev,
          { ...payload, source: "offline_sync" },
        ]);
        toast.info("Saved offline. It will sync when you reconnect.");
        return;
      }
      if (context?.previous)
        queryClient.setQueryData(["attendance-all"], context.previous);
      toast.error(
        error instanceof Error ? error.message : "Failed to save attendance",
      );
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-all"] });
      if (payload.notify_student)
        toast.success("Attendance saved and notification queued");
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (stored) setOfflineQueue(JSON.parse(stored) as AttendancePayload[]);
  }, []);

  useEffect(() => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    const syncQueue = () => {
      if (!navigator.onLine || offlineQueue.length === 0) return;
      const queue = [...offlineQueue];
      setOfflineQueue([]);
      queue.forEach((payload) => mutation.mutate(payload));
      toast.success(
        `Syncing ${queue.length} offline attendance mark${queue.length > 1 ? "s" : ""}`,
      );
    };
    window.addEventListener("online", syncQueue);
    syncQueue();
    return () => window.removeEventListener("online", syncQueue);
  }, [mutation, offlineQueue]);

  const buildPayload = useCallback(
    (
      student: Student,
      status: StatusOption,
      source: AttendancePayload["source"],
      note?: string,
    ): AttendancePayload => ({
      student_id: student.id,
      date,
      present: status.kind === "present",
      session_label: sessionLabel,
      excuse: excuseFromStatus(status),
      excuse_note:
        status.kind === "excused" && status.id === "other"
          ? note || "Custom excuse"
          : note || "",
      session_id: sessionId,
      mode,
      period,
      duration_minutes: duration,
      topic_tags: topicTags,
      source,
      attendance_note:
        note || recordByStudent.get(student.id)?.attendance_note || "",
      status_label: status.label,
      status_color: status.color,
      status_emoji: status.emoji,
      notify_student: notifyStudents && status.kind !== "present",
    }),
    [
      date,
      duration,
      mode,
      notifyStudents,
      period,
      recordByStudent,
      sessionId,
      sessionLabel,
      topicTags,
    ],
  );

  const markStudent = useCallback(
    (
      student: Student,
      statusId: string,
      source: AttendancePayload["source"] = "manual",
      note?: string,
    ) => {
      const status = statuses.find((item) => item.id === statusId);
      if (!status) return;
      mutation.mutate(buildPayload(student, status, source, note));
    },
    [buildPayload, mutation, statuses],
  );

  const markStudents = useCallback(
    (
      studentsToMark: Student[],
      statusId: string,
      source: AttendancePayload["source"] = "bulk",
    ) => {
      studentsToMark.forEach((student) =>
        markStudent(student, statusId, source),
      );
      toast.success(
        `Auto-saving ${studentsToMark.length} ${studentsToMark.length === 1 ? "student" : "students"}`,
      );
    },
    [markStudent],
  );

  const handleBulkImport = useCallback(
    (marks: { studentId: string; status: string; note: string }[]) => {
      marks.forEach(({ studentId, status, note }) => {
        const student = allStudents.find((s) => s.id === studentId);
        if (student) {
          markStudent(student, status, "bulk", note);
        }
      });
      toast.success(`Successfully imported/updated attendance for ${marks.length} students.`);
    },
    [allStudents, markStudent]
  );

  const applySmartDefault = useCallback(() => {
    if (defaultStatusId === "unmarked") return;
    const unmarked = filteredStudents.filter(
      (student) => !recordByStudent.get(student.id),
    );
    markStudents(unmarked, defaultStatusId, "bulk");
  }, [defaultStatusId, filteredStudents, markStudents, recordByStudent]);

  const simulateCheckInAutofill = useCallback(() => {
    const likelyJoined = filteredStudents.filter(
      (_, index) =>
        index % 4 !== 0 && !recordByStudent.get(filteredStudents[index].id),
    );
    markStudents(likelyJoined, "present", "auto_check_in");
  }, [filteredStudents, markStudents, recordByStudent]);

  const toggleSelect = useCallback(
    (studentId: string, index: number, shiftKey = false) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedIndex !== null) {
          const [start, end] = [
            Math.min(lastSelectedIndex, index),
            Math.max(lastSelectedIndex, index),
          ];
          visibleStudents
            .slice(start, end + 1)
            .forEach((student) => next.add(student.id));
        } else if (next.has(studentId)) {
          next.delete(studentId);
        } else {
          next.add(studentId);
        }
        return next;
      });
      setLastSelectedIndex(index);
    },
    [lastSelectedIndex, visibleStudents],
  );

  const toggleSelectAllVisible = useCallback(() => {
    const allVisibleSelected =
      visibleStudents.length > 0 &&
      visibleStudents.every((student) => selectedIds.has(student.id));
    setSelectedIds(
      allVisibleSelected
        ? new Set()
        : new Set(visibleStudents.map((student) => student.id)),
    );
  }, [selectedIds, visibleStudents]);

  const savePreset = useCallback(() => {
    const presets = JSON.parse(
      localStorage.getItem("attendance-filter-presets") || "[]",
    ) as Array<{
      name: string;
      search: string;
      batchFilter: string;
      statusFilter: string;
      sortOrder: SortOrder;
    }>;
    const name = `${batchFilter === "all" ? "All batches" : batchFilter} · ${statusFilter}`;
    localStorage.setItem(
      "attendance-filter-presets",
      JSON.stringify([
        ...presets.filter((preset) => preset.name !== name),
        { name, search, batchFilter, statusFilter, sortOrder },
      ]),
    );
    toast.success("Filter preset saved");
  }, [batchFilter, search, sortOrder, statusFilter]);

  const openVoiceMode = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error("Voice mode is not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionLike;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      const student = allStudents.find((item) =>
        transcript.includes(item.name.toLowerCase()),
      );
      const statusId =
        transcript.includes("excused") || transcript.includes("sick")
          ? "sick"
          : transcript.includes("absent")
            ? "absent"
            : "present";
      if (student) markStudent(student, statusId, "voice");
      else toast.error(`Could not match a student from: ${transcript}`);
    };
    recognition.onerror = () => toast.error("Voice command failed");
    recognition.start();
    toast.info("Listening: “Mark Riad Parvin as excused”");
  }, [allStudents, markStudent]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      )
        return;
      const focused = visibleStudents[focusIndex];
      if (!focused) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((index) =>
          Math.min(index + 1, visibleStudents.length - 1),
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key.toLowerCase() === "p")
        markStudent(focused, "present", "keyboard");
      if (event.key.toLowerCase() === "a")
        markStudent(focused, "absent", "keyboard");
      if (event.key.toLowerCase() === "e")
        markStudent(focused, "personal", "keyboard");
      if (event.key === " ") {
        event.preventDefault();
        toggleSelect(focused.id, focusIndex);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusIndex, markStudent, toggleSelect, visibleStudents]);

  useEffect(
    () => setFocusIndex(0),
    [search, batchFilter, statusFilter, sortOrder],
  );

  const isLoading = attLoading || studentsLoading;
  const attendanceRate = summary.scopedTotal
    ? Math.round((summary.present / summary.scopedTotal) * 100)
    : 0;

  return (
    <TooltipProvider>
      <div className="space-y-5 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Intelligent Attendance
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Autosave on
              </Badge>
              {offlineQueue.length > 0 && (
                <Badge variant="outline">{offlineQueue.length} offline</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Bulk mark, smart defaults, session setup, inline notes, and
              keyboard-first controls.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger render={
                <Button variant="outline" size="sm" className="text-slate-600 hover:text-slate-900 border border-slate-200" title="Attendance Help Guide">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Guide
                </Button>
              } />
              <DialogContent className="sm:max-w-md lg:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white shadow-xl border border-slate-200">
                <DialogHeader className="p-6 border-b shrink-0 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-600" />
                    <DialogTitle className="text-lg font-semibold text-slate-900">Intelligent Attendance Guide</DialogTitle>
                  </div>
                  <DialogDescription className="text-slate-500 text-xs mt-1">
                    Learn how tracking student attendance works, what each state means, and how logging syncs with the database.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6 overflow-y-auto">
                  <div className="space-y-6 pb-6 text-sm text-slate-600 leading-relaxed">
                    
                    <section className="space-y-2">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" /> Module Overview
                      </h4>
                      <p className="text-xs">
                        The Intelligent Attendance module manages classroom and mentor session logs. Instructors and mentors can record presence, excusal, and absence states using keyboard shortcuts, search queries, bulk selections, voice control, or self-check-in forms.
                      </p>
                    </section>

                    <section className="space-y-2">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Columns className="w-4 h-4 text-indigo-600" /> Attendance State Rules
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 border rounded-md bg-slate-50/50">
                          <span className="font-semibold text-slate-800">Present / Remote:</span> Student attended the class/session. Auto-updates their dashboard engagement metrics.
                        </div>
                        <div className="p-2.5 border rounded-md bg-slate-50/50">
                          <span className="font-semibold text-slate-800">Absent:</span> Student did not attend. Multiple consecutive absences trigger a warning notification.
                        </div>
                        <div className="p-2.5 border rounded-md bg-slate-50/50">
                          <span className="font-semibold text-slate-800">Excused (Exam/Sick/Personal):</span> Student absent with permission. Excused codes prevent heavy penalties in risk scoring.
                        </div>
                        <div className="p-2.5 border rounded-md bg-slate-50/50">
                          <span className="font-semibold text-slate-800">Unmarked:</span> Initial placeholder. Must be completed to submit active session records.
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Keyboard className="w-4 h-4 text-indigo-600" /> Smart Controls & Forms
                      </h4>
                      <div className="space-y-2 text-xs">
                        <p><strong>Setup Left Panel:</strong> Set class date, session names, duration, topics, and auto-close timers for self-check-ins.</p>
                        <p><strong>Auto-fill:</strong> Simulates self-check-in data logging for testing and validation flows.</p>
                        <p><strong>Student Self-Form:</strong> Mentors can generate a check-in link or QR code so students check in themselves, syncing with the live dashboard in real-time.</p>
                        <p><strong>Voice & Keyboard Controls:</strong> Use voice recognition to dictate attendance or use arrow keys + hotkeys (<code>P</code> for present, <code>A</code> for absent, <code>E</code> for excused) to log quickly.</p>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-indigo-600" /> Module Integrations & Sync
                      </h4>
                      <div className="space-y-2 text-xs">
                        <p><strong>Spreadsheet Sync:</strong> Submitting logs updates the <code>attendance_logs</code> sheet immediately using an optimistic offline-capable queue.</p>
                        <p><strong>Student Profile Tracker:</strong> Dynamic analytics evaluate the student&apos;s 10-day trailing attendance rate to flag risk levels.</p>
                        <p><strong>Risk Engine Sync:</strong> Dropping below 80% attendance in the past 30 days automatically moves the student&apos;s risk profile to high risk.</p>
                        <p><strong>Engagement Metrics:</strong> Updating attendance refreshes the student&apos;s <code>last_activity_date</code> database field.</p>
                      </div>
                    </section>

                  </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t bg-slate-50 flex sm:justify-end shrink-0">
                  <DialogClose render={<Button variant="outline">Close Guide</Button>} />
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeftPanelOpen((value) => !value)}
            >
              <PanelLeft className="w-4 h-4 mr-2" />
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["attendance-all"] })
              }
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")}
              />
              Refresh
            </Button>
            <Button size="sm" onClick={simulateCheckInAutofill}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-fill check-ins
            </Button>
            <CreateFormButton
              sessionId={sessionId}
              sessionLabel={sessionLabel}
              date={date}
              mode={mode}
              period={period}
              topicTags={topicTags}
              durationMinutes={duration}
              expiryMinutes={autoCloseMinutes}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveFormsDrawerOpen(true)}
            >
              <Users className="w-4 h-4 mr-2" />
              Active Forms
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import CSV/Excel
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <StatsCard
              title="Live Rate"
              value={`${attendanceRate}%`}
              subtitle={`${summary.present}/${summary.scopedTotal} present`}
              icon={UserCheck}
              color="emerald"
              info={{
                description: "Percentage of active students marked present in the selected session.",
                metrics: "Attendance logs for current session.",
                calculation: "Formula: (Present / Scoped Total) * 100",
                importance: "Helps monitor immediate cohort engagement during the class or session.",
              }}
            />
            <StatsCard
              title="Marked"
              value={summary.total}
              subtitle={`${summary.unmarked} unmarked`}
              icon={Users}
              color="indigo"
              info={{
                description: "Total number of students with a saved attendance status.",
                metrics: "Attendance status fields.",
                calculation: "Formula: Sum of marked student logs",
                importance: "Ensures no student is left unmarked before closing the session log.",
              }}
            />
            <StatsCard
              title="Present"
              value={summary.present}
              subtitle="Auto-updating"
              icon={Check}
              color="emerald"
              info={{
                description: "Total students who are in attendance for the session.",
                metrics: "Present status counts.",
                calculation: "Formula: Count of status = 'present'",
                importance: "Direct count of present students for tracking active learning metrics.",
              }}
            />
            <StatsCard
              title="Absent"
              value={summary.absent}
              subtitle="Follow-up enabled"
              icon={X}
              color="red"
              info={{
                description: "Total students marked absent (unexcused).",
                metrics: "Absent status count.",
                calculation: "Formula: Count of status = 'absent'",
                importance: "Triggers automated follow-up reminders to check on unexcused absences.",
              }}
            />
            <StatsCard
              title="Excused"
              value={summary.excused}
              subtitle="Confirmed reason"
              icon={FileText}
              color="amber"
              info={{
                description: "Students absent with an approved/verified excuse.",
                metrics: "Excused status count (sick, personal, exam).",
                calculation: "Formula: Count of status = 'excused'",
                importance: "Allows tracking approved leaves without applying heavy penalties to the risk profile.",
              }}
            />
          </div>
          {activeFormExists && (
            <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          {leftPanelOpen && (
            <Card className="border-border/60 shadow-sm h-fit xl:sticky xl:top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Pre-session setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={mode === "session" ? "default" : "outline"}
                      onClick={() => {
                        setMode("session");
                        setPeriod("full_day");
                      }}
                    >
                      Session
                    </Button>
                    <Button
                      variant={mode === "daily" ? "default" : "outline"}
                      onClick={() => {
                        setMode("daily");
                        setPeriod("morning");
                      }}
                    >
                      Daily Class
                    </Button>
                  </div>
                  {mode === "daily" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant={period === "morning" ? "secondary" : "outline"}
                        onClick={() => setPeriod("morning")}
                      >
                        Morning
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          period === "afternoon" ? "secondary" : "outline"
                        }
                        onClick={() => setPeriod("afternoon")}
                      >
                        Afternoon
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  <Label>
                    {mode === "daily" ? "Class label" : "Session name"}
                  </Label>
                  <Input
                    value={sessionName}
                    onChange={(event) => setSessionName(event.target.value)}
                    placeholder="React Hooks - Afternoon Session"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Input
                        type="number"
                        value={duration}
                        onChange={(event) =>
                          setDuration(Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Auto-close</Label>
                      <Input
                        type="number"
                        value={autoCloseMinutes}
                        onChange={(event) =>
                          setAutoCloseMinutes(Number(event.target.value))
                        }
                      />
                    </div>
                  </div>
                  <Label>Topic tags</Label>
                  <Input
                    value={topicTags}
                    onChange={(event) => setTopicTags(event.target.value)}
                    placeholder="React, Interview Prep"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Default status</Label>
                  <Select
                    value={defaultStatusId}
                    onValueChange={setDefaultStatusId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmarked">Start unmarked</SelectItem>
                      {visibleStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.emoji} Start as {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={applySmartDefault}
                    disabled={defaultStatusId === "unmarked"}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Apply default to unmarked
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Visible statuses</Label>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    {statuses.map((status) => (
                      <label
                        key={status.id}
                        className="flex items-center justify-between rounded-lg border p-2 text-sm"
                      >
                        <span>
                          {status.emoji} {status.label}
                        </span>
                        <Switch
                          checked={status.visible}
                          onCheckedChange={(checked) =>
                            setStatuses((prev) =>
                              prev.map((item) =>
                                item.id === status.id
                                  ? { ...item, visible: checked }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        Student check-in link
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Zoom/LMS/custom check-in autofill
                      </p>
                    </div>
                    <Switch
                      checked={checkInEnabled}
                      onCheckedChange={setCheckInEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Notify after mark</p>
                      <p className="text-xs text-muted-foreground">
                        Absent/excused follow-up message
                      </p>
                    </div>
                    <Switch
                      checked={notifyStudents}
                      onCheckedChange={setNotifyStudents}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between bg-card/40 border border-border/50 rounded-xl p-3 shadow-xs">
              <div>
                <p className="text-xs font-semibold text-slate-700">Attendance Analytics</p>
                <p className="text-[10px] text-muted-foreground">Historical charts and batch rates breakdown</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setAnalyticsOpen((prev) => !prev)}
              >
                {analyticsOpen ? "Hide Charts" : "Show Charts"}
              </Button>
            </div>

            {analyticsOpen && (
              <AttendanceAnalytics trendData={trendData} batchData={batchData} />
            )}

            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {format(parseISO(date), "EEEE, MMMM d, yyyy")} ·{" "}
                        {sessionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mode === "daily"
                          ? "Daily Class Mode creates AM/PM sub-records"
                          : "Session Mode tracks one topic/session"}{" "}
                        · {duration} min · closes after {autoCloseMinutes} min
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markStudents(filteredStudents, "present")}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark all filtered present
                    </Button>
                    <Button variant="outline" size="sm" onClick={openVoiceMode}>
                      <Mic className="w-4 h-4 mr-2" />
                      Voice
                    </Button>
                    <Button variant="outline" size="sm" onClick={savePreset}>
                      <Filter className="w-4 h-4 mr-2" />
                      Save preset
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Search name, batch, or status..."
                    />
                  </div>
                  <Select value={batchFilter} onValueChange={setBatchFilter}>
                    <SelectTrigger className="w-full lg:w-48">
                      <SelectValue placeholder="Batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All batches</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch} value={batch}>
                          {batch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => setSortOrder(value as SortOrder)}
                  >
                    <SelectTrigger className="w-full lg:w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Sort by name</SelectItem>
                      <SelectItem value="batch">Sort by batch</SelectItem>
                      <SelectItem value="last_attendance">
                        Last attendance date
                      </SelectItem>
                      <SelectItem value="likely_absent">
                        Most likely absent
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1 lg:ml-auto">
                    {(
                      [
                        "all",
                        "unmarked",
                        "present",
                        "absent",
                        "excused",
                      ] as const
                    ).map((filter) => (
                      <Button
                        key={filter}
                        size="sm"
                        variant={
                          statusFilter === filter ? "default" : "outline"
                        }
                        onClick={() => setStatusFilter(filter)}
                        className="capitalize"
                      >
                        {filter}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedIds.size > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-sm font-semibold text-primary">
                    {selectedIds.size} selected
                  </span>
                  <Separator orientation="vertical" className="h-5" />
                  {visibleStatuses.map((status) => (
                    <Button
                      key={status.id}
                      size="sm"
                      variant="outline"
                      className={cn(
                        "border",
                        STATUS_STYLES[status.color] || STATUS_STYLES.slate,
                      )}
                      onClick={() => markStudents(selectedStudents, status.id)}
                    >
                      {status.emoji} {status.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="border-b bg-muted/20 py-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Attendance sheet</CardTitle>
                  <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
                    <Keyboard className="w-4 h-4" /> P Present · A Absent · E
                    Excused · arrows navigate · space select
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-10">
                            <button
                              onClick={toggleSelectAllVisible}
                              aria-label="Select all visible"
                            >
                              {visibleStudents.length &&
                              visibleStudents.every((student) =>
                                selectedIds.has(student.id),
                              ) ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead>
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Student</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Mentee full name and identity avatar.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Rate</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Trailing 10-session attendance rate percentage.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="hidden lg:table-cell">
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Batch</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Assigned student batch/cohort identifier.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead>
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Status</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Current attendance status marked for this active session.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="min-w-[220px]">
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Mark</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Fast-action buttons to update attendance.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="min-w-[220px]">
                            <Tooltip>
                              <TooltipTrigger render={<span className="cursor-help inline-block">Quick note</span>} />
                              <TooltipContent className="bg-slate-950 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md font-normal border border-slate-800 normal-case tracking-normal">
                                Inline notes, excuse justifications, or class feedback remarks.
                              </TooltipContent>
                            </Tooltip>
                          </TableHead>
                          <TableHead className="w-12 text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleStudents.map((student, index) => {
                          const record = recordByStudent.get(student.id);
                          const stats = studentStats.get(student.id);
                          const selected = selectedIds.has(student.id);
                          const riskWarning = (stats?.excusedRecent || 0) >= 3;
                          return (
                            <TableRow
                              key={student.id}
                              data-focused={index === focusIndex}
                              className={cn(
                                "group transition-colors",
                                batchTint(student.batch),
                                selected && "bg-primary/10",
                                index === focusIndex &&
                                  "outline outline-2 outline-primary/30",
                              )}
                              onTouchStart={(event) => {
                                touchStartRef.current[student.id] =
                                  event.touches[0].clientX;
                              }}
                              onTouchEnd={(event) => {
                                const start =
                                  touchStartRef.current[student.id] || 0;
                                const delta =
                                  event.changedTouches[0].clientX - start;
                                if (delta > 80) markStudent(student, "present");
                                if (delta < -80) markStudent(student, "absent");
                              }}
                            >
                              <TableCell>
                                <button
                                  onClick={(event) =>
                                    toggleSelect(
                                      student.id,
                                      index,
                                      event.shiftKey,
                                    )
                                  }
                                  aria-label={`Select ${student.name}`}
                                >
                                  {selected ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </button>
                              </TableCell>
                              <TableCell>
                                <button
                                  className="flex items-center gap-3 text-left"
                                  onClick={() => setHistoryStudent(student)}
                                >
                                  <div className="relative">
                                    <Avatar>
                                      <AvatarFallback
                                        className={cn(
                                          "font-semibold",
                                          getAvatarColor(student.name),
                                        )}
                                      >
                                        {getInitials(student.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span
                                      className={cn(
                                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                                        statusFromRecord(record) === "present"
                                          ? "bg-emerald-400"
                                          : statusFromRecord(record) ===
                                              "absent"
                                            ? "bg-red-400"
                                            : statusFromRecord(record) ===
                                                "excused"
                                              ? "bg-amber-400"
                                              : "bg-slate-300",
                                      )}
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium leading-tight">
                                        {student.name}
                                      </p>
                                      {riskWarning && (
                                        <Tooltip>
                                          <TooltipTrigger
                                            render={
                                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            }
                                          />
                                          <TooltipContent>
                                            Excused 3+ times recently. Review
                                            pattern.
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground md:hidden">
                                      {student.batch} · {stats?.rate || 0}%
                                    </p>
                                  </div>
                                </button>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {stats?.rate || 0}%
                                  </Badge>
                                  <Sparkline values={stats?.trend || []} />
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <Badge variant="outline">{student.batch}</Badge>
                              </TableCell>
                              <TableCell>{statusBadge(record)}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  {visibleStatuses.map((status) => (
                                    <Button
                                      key={status.id}
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-9 border text-xs",
                                        STATUS_STYLES[status.color] ||
                                          STATUS_STYLES.slate,
                                      )}
                                      onClick={() =>
                                        markStudent(student, status.id)
                                      }
                                      disabled={
                                        mutation.isPending &&
                                        record?.student_id === student.id
                                      }
                                    >
                                      {status.emoji} {status.label}
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  defaultValue={
                                    record?.attendance_note ||
                                    record?.excuse_note ||
                                    ""
                                  }
                                  rows={1}
                                  placeholder="Called in sick, left early..."
                                  className="min-h-9 resize-none text-xs"
                                  onBlur={(event) => {
                                    const activeStatus =
                                      statuses.find(
                                        (status) =>
                                          status.label === record?.status_label,
                                      ) ||
                                      statuses.find(
                                        (status) =>
                                          status.kind ===
                                          statusFromRecord(record),
                                      );
                                    if (
                                      activeStatus &&
                                      event.currentTarget.value !==
                                        (record?.attendance_note || "")
                                    )
                                      markStudent(
                                        student,
                                        activeStatus.id,
                                        "manual",
                                        event.currentTarget.value,
                                      );
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger render={<span />}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      aria-label={`Actions for ${student.name}`}
                                      className="h-8 w-8 p-0 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl border-border/60 min-w-[140px]">
                                    <DropdownMenuItem onClick={() => setHistoryStudent(student)} className="text-xs font-semibold">
                                      View History
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => markStudent(student, "present")} className="text-xs font-semibold text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/5">
                                      Mark Present
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markStudent(student, "absent")} className="text-xs font-semibold text-red-600 focus:text-red-600 focus:bg-red-500/5">
                                      Mark Absent
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markStudent(student, "sick")} className="text-xs font-semibold text-amber-600 focus:text-amber-600 focus:bg-amber-500/5">
                                      Mark Sick
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markStudent(student, "personal")} className="text-xs font-semibold text-blue-600 focus:text-blue-600 focus:bg-blue-500/5">
                                      Mark Excused
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex flex-col gap-4 border-t bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      Showing <span className="font-semibold text-foreground">{Math.min(filteredStudents.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredStudents.length, currentPage * pageSize)}</span> of{" "}
                      <span className="font-semibold text-foreground">{filteredStudents.length}</span> matching students.
                    </p>
                    <p className="hidden md:block text-[10px] opacity-75">
                      Shift+click selects ranges. Mobile: swipe right Present, left Absent.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground whitespace-nowrap">Rows per page:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(val) => setPageSize(Number(val))}
                      >
                        <SelectTrigger className="h-8 w-[70px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10" className="text-xs">10</SelectItem>
                          <SelectItem value="25" className="text-xs">25</SelectItem>
                          <SelectItem value="50" className="text-xs">50</SelectItem>
                          <SelectItem value="100" className="text-xs">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <span className="text-muted-foreground whitespace-nowrap">
                      Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                      <span className="font-semibold text-foreground">{totalPages}</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Sheet
          open={!!historyStudent}
          onOpenChange={(open) => !open && setHistoryStudent(null)}
        >
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{historyStudent?.name}</SheetTitle>
              <SheetDescription>
                Attendance history, streak, and recent trend
              </SheetDescription>
            </SheetHeader>
            {historyStudent && (
              <div className="space-y-4 px-4 pb-6">
                <div className="grid grid-cols-3 gap-2">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="text-2xl font-bold">
                        {studentStats.get(historyStudent.id)?.rate || 0}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Excused</p>
                      <p className="text-2xl font-bold">
                        {studentStats.get(historyStudent.id)?.excusedRecent ||
                          0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Last</p>
                      <p className="text-sm font-bold">
                        {studentStats.get(historyStudent.id)?.lastDate ||
                          "None"}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium mb-3">Trend</p>
                  <Sparkline
                    values={studentStats.get(historyStudent.id)?.trend || []}
                  />
                </div>
                <div className="space-y-2">
                  {records
                    .filter((record) => record.student_id === historyStudent.id)
                    .slice(-20)
                    .reverse()
                    .map((record) => (
                      <div
                        key={`${record.id}-${record.date}`}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <span>
                          {record.date} · {record.session_label || "Session"}
                        </span>
                        {statusBadge(record)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={checkInEnabled && false} onOpenChange={() => undefined}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check-in</DialogTitle>
              <DialogDescription>
                Reserved for linked LMS/Zoom setup.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <ActiveFormsDrawer
          open={activeFormsDrawerOpen}
          onOpenChange={setActiveFormsDrawerOpen}
          date={date}
        />

        <AttendanceImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          students={allStudents}
          onImport={handleBulkImport}
        />
      </div>
    </TooltipProvider>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
