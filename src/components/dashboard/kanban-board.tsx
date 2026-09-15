"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Filter, X, Info } from "lucide-react";
import { StudentStage } from "@/types";
import { KanbanCard } from "./kanban-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type KanbanStudent = {
  id: string;
  name: string;
  batch: string;
  days_in_stage: number;
  risk_status?: string;
  job_focus?: string;
  project?: string;
};

type StudentsByStage = Record<StudentStage, KanbanStudent[]>;

// ── Stage config ───────────────────────────────────────────────────────────
const STAGES: {
  key: StudentStage;
  label: string;
  accent: string;
  badge: string;
}[] = [
  {
    key: "learning",
    label: "Learning",
    accent: "border-t-slate-400",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    key: "applying",
    label: "Applying",
    accent: "border-t-blue-500",
    badge: "bg-blue-50 text-blue-700",
  },
  {
    key: "interviewing",
    label: "Interviewing",
    accent: "border-t-amber-500",
    badge: "bg-amber-50 text-amber-700",
  },
  {
    key: "offer_pending",
    label: "Offer Pending",
    accent: "border-t-orange-500",
    badge: "bg-orange-50 text-orange-700",
  },
  {
    key: "placed",
    label: "Placed",
    accent: "border-t-emerald-500",
    badge: "bg-emerald-50 text-emerald-700",
  },
];

const STAGE_KEYS = STAGES.map((s) => s.key);

// ── Filter bar ────────────────────────────────────────────────────────────
interface FilterState {
  batch: string;
  risk: string;
}

function FilterBar({
  filters,
  onChange,
  onClear,
  batches,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClear: () => void;
  batches: string[];
}) {
  const hasActive = filters.batch || filters.risk;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        <span>Filter:</span>
      </div>

      <select
        value={filters.batch}
        onChange={(e) => onChange({ ...filters, batch: e.target.value })}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">All Batches</option>
        {batches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        value={filters.risk}
        onChange={(e) => onChange({ ...filters, risk: e.target.value })}
        className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">All Risk</option>
        <option value="safe">Safe</option>
        <option value="at_risk">At Risk</option>
      </select>

      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-xs gap-1"
        >
          <X className="w-3 h-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ── Droppable column ───────────────────────────────────────────────────────
function DroppableColumn({
  stage,
  label,
  accent,
  badge,
  students,
  readOnly,
  isOver,
}: {
  stage: StudentStage;
  label: string;
  accent: string;
  badge: string;
  students: KanbanStudent[];
  readOnly: boolean;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border border-border/60 bg-card shadow-sm transition-colors min-h-[520px]",
        "border-t-4",
        accent,
        isOver && "bg-primary/5 border-primary/30",
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <TooltipProvider delay={0}>
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors cursor-help">
                  <Info className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="max-w-sm p-3 shadow-lg border border-border/50 bg-background">
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-foreground">{label} Stage</p>
                  {label === "Learning" && (
                    <>
                      <p className="text-muted-foreground">Students are currently learning and preparing for job search.</p>
                      <p className="text-muted-foreground"><strong>Focus:</strong> Skill development, resume building, interview prep</p>
                      <p className="text-muted-foreground"><strong>Action:</strong> Drag cards to &quot;Applying&quot; when ready</p>
                    </>
                  )}
                  {label === "Applying" && (
                    <>
                      <p className="text-muted-foreground">Students are actively applying to job positions.</p>
                      <p className="text-muted-foreground"><strong>Focus:</strong> Job applications, networking, company research</p>
                      <p className="text-muted-foreground"><strong>Action:</strong> Drag cards to &quot;Interviewing&quot; when they get interviews</p>
                    </>
                  )}
                  {label === "Interviewing" && (
                    <>
                      <p className="text-muted-foreground">Students are in interview rounds with companies.</p>
                      <p className="text-muted-foreground"><strong>Focus:</strong> Interview preparation, feedback, follow-ups</p>
                      <p className="text-muted-foreground"><strong>Action:</strong> Drag cards to &quot;Offer Pending&quot; when offers are coming</p>
                    </>
                  )}
                  {label === "Offer Pending" && (
                    <>
                      <p className="text-muted-foreground">Students have received job offers and are deciding.</p>
                      <p className="text-muted-foreground"><strong>Focus:</strong> Offer negotiation, decision support</p>
                      <p className="text-muted-foreground"><strong>Action:</strong> Drag cards to &quot;Placed&quot; when they accept</p>
                    </>
                  )}
                  {label === "Placed" && (
                    <>
                      <p className="text-muted-foreground">Students have accepted job offers and are starting work.</p>
                      <p className="text-muted-foreground"><strong>Focus:</strong> Onboarding support, success tracking</p>
                      <p className="text-muted-foreground"><strong>Status:</strong> Final stage before completion</p>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span
          className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            badge,
          )}
        >
          {students.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 overflow-y-auto">
        <SortableContext
          items={students.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
          disabled={readOnly}
        >
          <div className="space-y-2 min-h-[400px]">
            {students.length === 0 ? (
              <div
                className={cn(
                  "flex items-center justify-center h-24 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors",
                  isOver
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border/40",
                )}
              >
                {isOver ? "Drop here" : "No students"}
              </div>
            ) : (
              students.map((student) => (
                <KanbanCard key={student.id} student={student} />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  readOnly?: boolean;
}

export function KanbanBoard({ readOnly = false }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<StudentStage | null>(null);
  const [filters, setFilters] = useState<FilterState>({ batch: "", risk: "" });

  const { data, isLoading, isFetching } = useQuery<StudentsByStage>({
    queryKey: ["placement"],
    queryFn: async () => {
      const res = await fetch("/api/placement");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      // Include all student fields for filtering
      const base: StudentsByStage = {
        learning: [],
        applying: [],
        interviewing: [],
        offer_pending: [],
        placed: [],
        hired: [],
      };
      const raw = json.students_by_stage ?? {};
      STAGE_KEYS.forEach((k) => {
        base[k] = raw[k] ?? [];
      });
      return base;
    },
    refetchInterval: 30000,
  });

  const allStudents = useMemo(
    () => STAGE_KEYS.flatMap((k) => data?.[k] ?? []),
    [data],
  );

  const batches = useMemo(
    () =>
      Array.from(
        new Set(allStudents.map((s) => s.batch).filter(Boolean)),
      ).sort(),
    [allStudents],
  );

  const filteredStudents = useMemo(() => {
    let result = allStudents;
    if (filters.batch) {
      result = result.filter((s) => s.batch === filters.batch);
    }
    if (filters.risk) {
      result = result.filter((s) => s.risk_status === filters.risk);
    }
    return result;
  }, [allStudents, filters]);

  const studentsByStage = useMemo(() => {
    const grouped: StudentsByStage = {
      learning: [],
      applying: [],
      interviewing: [],
      offer_pending: [],
      placed: [],
      hired: [],
    };
    for (const s of filteredStudents) {
      const stage = STAGE_KEYS.find((k) =>
        data?.[k]?.some((d) => d.id === s.id),
      ) as StudentStage | undefined;
      if (stage) grouped[stage].push(s);
    }
    return grouped;
  }, [filteredStudents, data]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Find which stage a student currently belongs to
  const findStage = useCallback(
    (studentId: string): StudentStage | null => {
      if (!data) return null;
      for (const stage of STAGE_KEYS) {
        if (data[stage]?.some((s) => s.id === studentId)) return stage;
      }
      return null;
    },
    [data],
  );

  // Resolve the target stage from over.id (could be a stage key or a card id)
  const resolveTargetStage = useCallback(
    (overId: string): StudentStage | null => {
      if (STAGE_KEYS.includes(overId as StudentStage))
        return overId as StudentStage;
      return findStage(overId); // card id → find its column
    },
    [findStage],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) {
      setOverId(null);
      return;
    }
    const target = resolveTargetStage(event.over.id as string);
    setOverId(target);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);

    const { active, over } = event;
    if (!over || readOnly) return;

    const studentId = active.id as string;
    const newStage = resolveTargetStage(over.id as string);
    const currentStage = findStage(studentId);

    if (!newStage || !currentStage || currentStage === newStage) return;

    // Optimistic update — deep clone to avoid mutation
    const snapshot = JSON.parse(JSON.stringify(data)) as StudentsByStage;

    queryClient.setQueryData<StudentsByStage>(["placement"], (old) => {
      if (!old) return old;
      const next: StudentsByStage = { ...old };
      STAGE_KEYS.forEach((k) => {
        next[k] = [...(old[k] ?? [])];
      });

      const idx = next[currentStage].findIndex((s) => s.id === studentId);
      if (idx === -1) return old;
      const [student] = next[currentStage].splice(idx, 1);
      next[newStage] = [...(next[newStage] ?? []), student];
      return next;
    });

    try {
      const res = await fetch(`/api/placement/${studentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        const result = await res.json();
        toast.error(result.message || "Failed to update stage");
        queryClient.setQueryData(["placement"], snapshot);
      } else {
        toast.success(
          `Moved to ${STAGES.find((s) => s.key === newStage)?.label}`,
        );
        queryClient.invalidateQueries({ queryKey: ["placement"] });
        queryClient.invalidateQueries({ queryKey: ["placement-stats"] });
      }
    } catch {
      toast.error("Failed to update stage");
      queryClient.setQueryData(["placement"], snapshot);
    }
  };

  // Active card data for drag overlay
  const activeStudent = activeId
    ? STAGE_KEYS.flatMap((k) => data?.[k] ?? []).find((s) => s.id === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {STAGES.map((s) => (
          <div key={s.key} className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters({ batch: "", risk: "" })}
          batches={batches}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["placement"] })
          }
          disabled={isFetching}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-4">
          {STAGES.map(({ key, label, accent, badge }) => (
            <DroppableColumn
              key={key}
              stage={key}
              label={label}
              accent={accent}
              badge={badge}
              students={studentsByStage[key] ?? []}
              readOnly={readOnly}
              isOver={overId === key}
            />
          ))}
        </div>

        {/* Drag overlay — renders the card while dragging */}
        <DragOverlay>
          {activeStudent ? (
            <KanbanCard student={activeStudent} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
