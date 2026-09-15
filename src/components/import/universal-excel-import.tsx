"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  IMPORT_FIELDS,
  normalizeRows,
  parseExcelFile,
  generateExcelTemplate,
  type ColumnMapping,
  type ParsedWorkbook,
} from "@/lib/import/excel-mapper";
import { usePlacementStore } from "@/lib/placement/store";

type Step = "prompt" | "upload" | "map" | "conflicts" | "sync" | "done";

interface UniversalExcelImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResponse {
  summary: {
    imported: number;
    updated: number;
    skipped: number;
    conflicts: number;
    attendance_created: number;
    progress_created: number;
    risk_scores_generated: number;
    leaderboard_recalculated: boolean;
  };
  module_status: {
    label: string;
    status: "complete" | "skipped";
    detail: string;
  }[];
  students: import("@/types").Student[];
  results: { row: number; name: string; status: string; message?: string }[];
}

const STEP_LABELS: Record<Step, string> = {
  prompt: "Template Check",
  upload: "Upload File",
  map: "Column Mapping",
  conflicts: "Conflicts",
  sync: "Syncing Data",
  done: "Import Complete",
};

export function UniversalExcelImport({
  open,
  onOpenChange,
}: UniversalExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { students, applyImportResult, refresh } = usePlacementStore();
  const [step, setStep] = useState<Step>("prompt");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [conflictActions, setConflictActions] = useState<
    Record<string, "skip" | "overwrite" | "merge">
  >({});
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const normalized = useMemo(
    () => (parsed ? normalizeRows(parsed.rows, mappings) : []),
    [parsed, mappings],
  );
  
  const conflicts = useMemo(() => {
    const emails = new Set(
      students
        .map((student) => student.student_email?.toLowerCase())
        .filter(Boolean),
    );
    return normalized.filter(
      (row) =>
        row.student.student_email &&
        emails.has(row.student.student_email.toLowerCase()),
    );
  }, [normalized, students]);

  const reset = () => {
    setStep("prompt");
    setFile(null);
    setParsed(null);
    setMappings([]);
    setConflictActions({});
    setProgress(0);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const parseFile = async (nextFile: File) => {
    setFile(nextFile);
    setIsParsing(true);
    try {
      const workbook = await parseExcelFile(nextFile);

      // Strict layout validation: checking if all exact required template headers are present
      const requiredHeaders = IMPORT_FIELDS.map((f) => f.label);
      const fileHeaders = workbook.headers.map((h) => h.trim().toLowerCase());
      const missingRequired = requiredHeaders.filter(
        (rh) => !fileHeaders.includes(rh.trim().toLowerCase()),
      );

      if (missingRequired.length > 0) {
        toast.error(
          `Validation Failed: The uploaded Excel file must follow the correct column structure. Missing: ${missingRequired.join(
            ", ",
          )}`,
          { duration: 8000 },
        );
        setIsParsing(false);
        setFile(null);
        return;
      }

      setParsed(workbook);
      setMappings(workbook.mappings);
      setStep("map");
      toast.success("File parsed. Review column mapping before import.");
    } catch {
      toast.error(
        "Could not parse this file. Upload a valid .xlsx, .xls, or .csv file.",
      );
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const updateMapping = (field: ColumnMapping["field"], source: string) => {
    setMappings((current) =>
      current.map((mapping) =>
        mapping.field === field
          ? { ...mapping, source, confidence: source ? 1 : 0 }
          : mapping,
      ),
    );
  };

  const confirmImport = async () => {
    if (!file) return;
    setStep("sync");
    setProgress(12);
    try {
      const payloadRows = normalized.map((row) => ({
        ...row,
        conflict_action: row.student.student_email
          ? conflictActions[row.student.student_email.toLowerCase()] || "merge"
          : "merge",
      }));
      setProgress(38);
      const res = await fetch("/api/import/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, rows: payloadRows }),
      });
      setProgress(72);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Import failed");
      setResult(data);
      applyImportResult(data.students, {
        id: `${Date.now()}`,
        file_name: file.name,
        total_rows: normalized.length,
        imported: data.summary.imported,
        updated: data.summary.updated,
        conflicts: data.summary.conflicts,
        created_at: new Date().toISOString(),
      });
      await refresh();
      setProgress(100);
      setStep("done");
      toast.success(
        `${data.summary.imported} students imported · ${data.summary.updated} updated · ${data.summary.conflicts} conflicts handled`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
      setStep("map");
    }
  };

  const confirmMapping = () => {
    const hasName = mappings.some(
      (mapping) => mapping.field === "name" && mapping.source,
    );
    if (!hasName) {
      toast.error("Map the Name column before importing.");
      return;
    }
    if (conflicts.length) {
      setStep("conflicts");
    } else {
      confirmImport();
    }
  };

  // Render Horizontal Wizard Steps
  const renderWizardSteps = () => {
    const steps: Step[] = ["prompt", "upload", "map", "conflicts", "sync", "done"];
    const currentIdx = steps.indexOf(step);

    return (
      <div className="flex items-center justify-between w-full border-b pb-4 mb-6 overflow-x-auto scrollbar-none gap-2">
        {steps.map((s, idx) => {
          const isActive = step === s;
          const isCompleted = currentIdx > idx;
          return (
            <div key={s} className="flex items-center shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    isActive
                      ? "bg-purple-600 text-white shadow-xs scale-105"
                      : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
                  )}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold whitespace-nowrap transition-colors",
                    isActive
                      ? "text-purple-600 font-bold"
                      : isCompleted
                      ? "text-emerald-600"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 mx-2 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-4xl w-full max-h-[95vh] !flex flex-col p-6 rounded-2xl border border-border/60 dark:border-border/30 bg-card shadow-lg gap-0 overflow-hidden">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Universal Excel Import
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            Seamlessly import or batch-update your student rosters and attendance.
          </DialogDescription>
        </DialogHeader>
 
        <div className="flex-1 overflow-y-auto py-5 pr-1 scrollbar-thin">
          {renderWizardSteps()}
 
          {step === "prompt" && (
            <div className="space-y-6 py-6 text-center max-w-lg mx-auto">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30 shadow-xs">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Do you already have the formatted Excel template?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  This process requires the uploaded Excel file to follow the exact column structure. If headings do not match the template, validation will fail.
                </p>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row pt-4">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto font-bold rounded-xl h-11 px-5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => {
                    generateExcelTemplate();
                    setStep("upload");
                  }}
                >
                  No, download template
                </Button>
                <Button
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-11 px-5 transition-colors text-white"
                  onClick={() => setStep("upload")}
                >
                  Yes, I have the template
                </Button>
              </div>
            </div>
          )}

          {step === "upload" && (
            <div className="py-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload Excel file"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const nextFile = event.dataTransfer.files[0];
                  if (nextFile) parseFile(nextFile);
                }}
                onDragOver={(event) => event.preventDefault()}
                className="rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-900/50 bg-purple-50/10 dark:bg-purple-950/5 p-12 text-center outline-none transition-all duration-300 hover:border-purple-400 dark:hover:border-purple-700 focus-visible:ring-2 focus-visible:ring-purple-500 cursor-pointer"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30">
                  {isParsing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <p className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Drag and drop your Excel file here
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  or click to browse (.xlsx, .xls, or .csv)
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0];
                    if (nextFile) parseFile(nextFile);
                  }}
                />
              </div>
              <div className="flex justify-start mt-4">
                <Button variant="ghost" className="font-bold text-xs rounded-xl" onClick={() => setStep("prompt")}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {step === "map" && parsed && (
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-xl border bg-slate-50/50 dark:bg-slate-900/30 p-4 shadow-2xs border-border/40">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 border border-purple-200/30 dark:border-purple-900/30">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">{file?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                      {parsed.rows.length} rows detected · {parsed.headers.length} columns
                    </p>
                  </div>
                </div>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-10 px-4 transition-colors" onClick={confirmMapping}>
                  Preview &amp; Continue
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => {
                  const mapping = mappings.find((item) => item.field === field.key);
                  const confidence = mapping?.confidence || 0;
                  return (
                    <div
                      key={field.key}
                      className="rounded-xl border bg-white dark:bg-slate-900/50 p-4 flex flex-col justify-between border-border/40 shadow-2xs hover:shadow-xs transition-shadow"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                          {field.label}
                          {field.required ? " *" : ""}
                        </span>
                        {mapping?.source && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold border",
                              confidence >= 0.9
                                ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30"
                                : confidence >= 0.7
                                ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50"
                            )}
                          >
                            {Math.round(confidence * 100)}% match
                          </span>
                        )}
                      </div>
                      <Select
                        value={mapping?.source || "__none__"}
                        onValueChange={(value) =>
                          updateMapping(field.key, value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger className="h-9 rounded-lg border-border/50">
                          <SelectValue placeholder="Select source column" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[220px]">
                          <SelectItem value="__none__">Not included</SelectItem>
                          {parsed.headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              {/* Data Preview Table */}
              <div className="rounded-xl border bg-card shadow-2xs border-border/40 overflow-hidden">
                <div className="border-b px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/10">
                  Preview first 5 rows
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-left uppercase text-slate-500 dark:text-slate-400 border-b border-border/30">
                      <tr>
                        {["Name", "Email", "Project", "Batch", "Stage", "Risk", "Last Active"].map((header) => (
                          <th key={header} className="px-4 py-3 font-bold text-[10px]">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {normalized.slice(0, 5).map((row) => (
                        <tr key={row.row_number} className="hover:bg-muted/5 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{row.student.name || "-"}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{row.student.student_email || "-"}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{row.student.project || "-"}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">{row.student.batch || "-"}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">{row.student.stage}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">{row.student.risk_override_level || "Auto"}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.student.last_activity_date || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === "conflicts" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-900/30 bg-amber-500/5 dark:bg-amber-950/10 p-4 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-200 text-sm tracking-tight">
                    {conflicts.length} email conflict{conflicts.length === 1 ? "" : "s"} found
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-0.5 leading-relaxed">
                    These students already exist in your system. Choose how you want to handle each override.
                  </p>
                </div>
              </div>
              <div className="max-h-[380px] overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30 bg-card pr-1">
                {conflicts.map((row) => (
                  <div
                    key={`${row.row_number}-${row.student.student_email}`}
                    className="grid gap-4 border-b p-4 md:grid-cols-[1fr_200px] items-center hover:bg-muted/5 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">{row.student.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                        {row.student.student_email}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Incoming: {row.student.project || "No Project"} · {row.student.stage} · {row.student.batch || "No Batch"}
                      </p>
                    </div>
                    <Select
                      value={
                        conflictActions[row.student.student_email.toLowerCase()] || "merge"
                      }
                      onValueChange={(value: "skip" | "overwrite" | "merge") =>
                        setConflictActions((current) => ({
                          ...current,
                          [row.student.student_email.toLowerCase()]: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        aria-label={`Conflict action for ${row.student.name}`}
                        className="h-9 rounded-lg border-border/50"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merge">Merge Profiles</SelectItem>
                        <SelectItem value="overwrite">Overwrite Full</SelectItem>
                        <SelectItem value="skip">Skip Row</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="font-bold rounded-xl" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-5" onClick={confirmImport}>
                  Resolve &amp; Import
                </Button>
              </div>
            </div>
          )}

          {step === "sync" && (
            <div className="space-y-6 py-12 max-w-md mx-auto text-center">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 shadow-xs">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
              <div className="space-y-1.5">
                <p className="font-black text-slate-900 dark:text-slate-100 text-lg tracking-tight">
                  Syncing Placement modules
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  Updating profiles, attendance records, risk metrics, and leaderboards together. Please wait...
                </p>
              </div>
              <Progress value={progress} className="h-2 rounded-full" />
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-500/5 dark:bg-emerald-950/10 p-5 flex gap-3 items-start shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-base font-black text-emerald-900 dark:text-emerald-200 tracking-tight">
                    {result.summary.imported} students imported · {result.summary.updated} updated · {result.summary.conflicts} conflicts resolved
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold mt-1 leading-relaxed">
                    Placement data has been fully synced across your dashboard, risk tracker, and leaderboard metrics.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {result.module_status.map((module) => (
                  <div
                    key={module.label}
                    className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-2xs border-border/40 hover:shadow-xs transition-shadow"
                  >
                    <span className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                      {module.status === "complete" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      )}
                      {module.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 rounded-md px-2 py-0.5">
                      {module.detail}
                    </span>
                  </div>
                ))}
              </div>

              {result.results.some((row) => row.status === "failed") && (
                <div className="rounded-xl border border-red-200/50 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-2.5 items-start">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="font-bold text-red-900 dark:text-red-200 text-sm tracking-tight">Some rows failed import</p>
                      <p className="text-xs text-red-800 dark:text-red-300 font-semibold mt-0.5">Please review the error details.</p>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    className="text-xs font-bold text-red-750 dark:text-red-400 underline p-0 h-auto self-start sm:self-center"
                    onClick={() => {
                      const blob = new Blob(
                        [
                          JSON.stringify(
                            result.results.filter((row) => row.status === "failed"),
                            null,
                            2,
                          ),
                        ],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "placement-import-errors.json";
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download error report
                  </Button>
                </div>
              )}
              
              <div className="flex justify-end pt-2 border-t">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-6 h-10 transition-colors" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
