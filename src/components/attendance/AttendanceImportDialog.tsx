"use client";

import React, { useRef, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  name: string;
  batch: string;
  mentor_email: string;
}

interface AttendanceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  onImport: (marks: { studentId: string; status: string; note: string }[]) => void;
}

export function AttendanceImportDialog({
  open,
  onOpenChange,
  students,
  onImport,
}: AttendanceImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);

  // Column selectors
  const [identityColumn, setIdentityColumn] = useState<string>("");
  const [statusColumn, setStatusColumn] = useState<string>("");
  const [noteColumn, setNoteColumn] = useState<string>("");

  const resetState = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setIdentityColumn("");
    setStatusColumn("");
    setNoteColumn("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      if (rawRows.length === 0) {
        toast.error("The selected file contains no data.");
        resetState();
        return;
      }

      // Extract all headers
      const sheetHeaders = Object.keys(rawRows[0]);
      setHeaders(sheetHeaders);
      setRows(rawRows);

      // Guess columns
      const lowerHeaders = sheetHeaders.map((h) => h.toLowerCase());
      
      const emailIdx = lowerHeaders.findIndex((h) => h.includes("email"));
      const nameIdx = lowerHeaders.findIndex((h) => h.includes("name") || h.includes("student") || h.includes("mentee"));
      const statusIdx = lowerHeaders.findIndex((h) => h.includes("status") || h.includes("attend") || h.includes("present"));
      const noteIdx = lowerHeaders.findIndex((h) => h.includes("note") || h.includes("comment") || h.includes("remark"));

      if (emailIdx !== -1) {
        setIdentityColumn(sheetHeaders[emailIdx]);
      } else if (nameIdx !== -1) {
        setIdentityColumn(sheetHeaders[nameIdx]);
      } else {
        setIdentityColumn(sheetHeaders[0]);
      }

      if (statusIdx !== -1) {
        setStatusColumn(sheetHeaders[statusIdx]);
      } else {
        setStatusColumn("");
      }

      if (noteIdx !== -1) {
        setNoteColumn(sheetHeaders[noteIdx]);
      }
    } catch (err) {
      toast.error("Failed to parse file. Please upload a valid CSV or Excel file.");
      resetState();
    }
  };

  // Process rows to find matches and status mappings
  const parsedRecords = useMemo(() => {
    if (!rows.length || !identityColumn) return [];

    return rows.map((row, idx) => {
      const rawIdentity = String(row[identityColumn] || "").trim();
      const rawStatus = statusColumn ? String(row[statusColumn] || "").trim().toLowerCase() : "present";
      const rawNote = noteColumn ? String(row[noteColumn] || "").trim() : "";

      // Match student
      const matchedStudent = students.find((s) => {
        // Match by exact email (if email is used) or case-insensitive name match
        if (rawIdentity.includes("@")) {
          // Can't match if student doesn't have email in this list, but we can fall back to name matching
          return s.name.toLowerCase() === rawIdentity.toLowerCase();
        }
        return s.name.toLowerCase() === rawIdentity.toLowerCase() ||
               s.name.toLowerCase().includes(rawIdentity.toLowerCase()) && rawIdentity.length > 3;
      });

      // Parse status
      let parsedStatus = "present";
      if (rawStatus.includes("abs") || rawStatus === "a" || rawStatus === "no" || rawStatus === "false") {
        parsedStatus = "absent";
      } else if (rawStatus.includes("exc") || rawStatus.includes("sick") || rawStatus.includes("exam") || rawStatus.includes("leave") || rawStatus === "e") {
        parsedStatus = "excused";
      }

      return {
        rowNum: idx + 2,
        rawIdentity,
        rawStatus,
        parsedStatus,
        rawNote,
        matchedStudent,
      };
    });
  }, [rows, identityColumn, statusColumn, noteColumn, students]);

  const matchedCount = useMemo(() => {
    return parsedRecords.filter((r) => !!r.matchedStudent).length;
  }, [parsedRecords]);

  const handleImportSubmit = () => {
    const importPayload = parsedRecords
      .filter((r) => !!r.matchedStudent)
      .map((r) => ({
        studentId: r.matchedStudent!.id,
        status: r.parsedStatus,
        note: r.rawNote,
      }));

    if (importPayload.length === 0) {
      toast.error("No students were matched. Please check your identity column selection.");
      return;
    }

    onImport(importPayload);
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetState();
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-xl border border-slate-200">
        <DialogHeader className="p-6 border-b shrink-0 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Bulk Import Attendance
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 text-xs mt-1">
            Upload attendance reports (e.g. from Zoom, Google Forms, or LMS) and match them directly with student profiles.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* File Upload Area */}
          {!file ? (
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer bg-slate-50/50"
                 onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-3 bg-white rounded-full shadow-sm border">
                <Upload className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-700">Upload Attendance File</p>
                <p className="text-xs text-slate-400">Excel (.xlsx, .xls) or CSV files up to 10MB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border rounded-lg p-3 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-md">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 truncate max-w-[280px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB · {rows.length} rows detected
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Change File
                </Button>
              </div>

              {/* Column Mapping Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-xl bg-white shadow-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    Student Name/Email Column
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select value={identityColumn} onValueChange={setIdentityColumn}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Choose column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Status Column (Optional)
                  </Label>
                  <Select value={statusColumn} onValueChange={setStatusColumn}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Mark all as Present" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">
                        Default: Present
                      </SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Note/Remarks Column (Optional)
                  </Label>
                  <Select value={noteColumn} onValueChange={setNoteColumn}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="No notes column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">
                        None
                      </SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h} className="text-xs">
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Matching Status Info */}
              <div className="flex items-center justify-between border border-dashed rounded-lg p-3 bg-slate-50/20 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Matched {matchedCount} of {students.length} students in current cohort.
                </span>
                {matchedCount < students.length && (
                  <span className="flex items-center gap-1 text-amber-600 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {students.length - matchedCount} students unmatched
                  </span>
                )}
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Matched Results Preview</Label>
                <div className="border rounded-xl overflow-hidden bg-white">
                  <ScrollArea className="h-44">
                    <Table>
                      <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-bold py-2">Row</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold py-2">Input Value</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold py-2">Matched Student</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold py-2">Final Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedRecords.map((r, idx) => (
                          <TableRow key={idx} className={r.matchedStudent ? "" : "opacity-50 bg-slate-50/20"}>
                            <TableCell className="text-xs py-2">{r.rowNum}</TableCell>
                            <TableCell className="text-xs font-medium py-2 truncate max-w-[140px]">{r.rawIdentity}</TableCell>
                            <TableCell className="text-xs py-2">
                              {r.matchedStudent ? (
                                <span className="font-semibold text-indigo-600">{r.matchedStudent.name}</span>
                              ) : (
                                <span className="text-slate-400 italic">No match</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-2">
                              {r.matchedStudent ? (
                                <Badge
                                  className={
                                    r.parsedStatus === "present"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : r.parsedStatus === "absent"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                  }
                                >
                                  {r.parsedStatus}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 flex sm:justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {file && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleImportSubmit}
              disabled={matchedCount === 0}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Apply Import ({matchedCount})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
