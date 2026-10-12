"use client";

import { useState, useEffect } from "react";
import { 
  Video, Sparkles, Clock, User, Calendar, BookOpen, 
  Copy, Check, Send, Plus, Trash2, ArrowRight, ShieldCheck,
  FileSpreadsheet, Upload, Lock, Users, Camera, AlertCircle, Link as LinkIcon, Download, Loader2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { saveCustomInterview, type CustomInterviewSession } from "@/lib/interviews/custom-session";

const PRESET_BATCHES = [
  "Batch-01 (Web Dev)",
  "Batch-02 (Frontend)",
  "Batch-03 (Fullstack)",
  "Q1-2025 Placement Batch",
  "Q2-2025 Placement Batch",
];

export function CreateInterviewView() {
  const [selectedBatch, setSelectedBatch] = useState("Batch-01 (Web Dev)");
  const [customBatch, setCustomBatch] = useState("");
  const [interviewTitle, setInterviewTitle] = useState("Batch Technical Mock Interview");
  const [interviewRole, setInterviewRole] = useState("Junior Frontend Developer");
  const [durationMinutes, setDurationMinutes] = useState("30");
  
  // Camera Mandatory (Requirement 2)
  const [cameraMandatory, setCameraMandatory] = useState(true);

  // Time Slot Enforcement (Requirement 4)
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");

  useEffect(() => {
    const defaultStart = new Date().toISOString().slice(0, 16);
    const defaultEnd = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setSlotStartTime(defaultStart);
    setSlotEndTime(defaultEnd);
  }, []);

  // Google Sheet Link / Upload / Whitelist (Requirement 3)
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [allowedEmailsText, setAllowedEmailsText] = useState("");
  const [parsedEmails, setParsedEmails] = useState<string[]>([
    "student1@example.com",
    "student2@example.com",
    "rahul@example.com"
  ]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [skills] = useState<string[]>(["React", "JavaScript", "HTML/CSS"]);
  const [instructions] = useState(
    "Ensure your camera is turned on throughout the interview. Answer all questions within the allocated time slot."
  );

  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Fetch Google Sheet URL (Requirement 3: Anyone with link view/edit access)
  const handleFetchGoogleSheet = async () => {
    if (!googleSheetUrl.trim()) {
      toast.error("Please enter a Google Sheet URL.");
      return;
    }

    const match = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      toast.error("Invalid Google Sheet link. Please paste a valid link (e.g. https://docs.google.com/spreadsheets/d/ID/edit).");
      return;
    }

    const spreadsheetId = match[1];
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    setIsFetchingSheet(true);

    try {
      const response = await fetch(csvExportUrl);
      if (!response.ok) {
        throw new Error("Could not access Google Sheet. Please make sure link sharing is set to 'Anyone with the link can view' or 'Editor'.");
      }

      const csvText = await response.text();
      const wb = XLSX.read(csvText, { type: "string" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const extractedEmails: string[] = [];
      data.forEach((row) => {
        Object.entries(row).forEach(([, val]) => {
          if (typeof val === "string" && val.includes("@")) {
            const cleaned = val.trim().toLowerCase();
            if (!extractedEmails.includes(cleaned)) {
              extractedEmails.push(cleaned);
            }
          }
        });
      });

      if (extractedEmails.length > 0) {
        setParsedEmails(extractedEmails);
        setUploadedFileName("Google Sheet URL");
        toast.success(`Successfully imported ${extractedEmails.length} candidate emails from Google Sheet!`);
      } else {
        toast.error("No valid candidate email addresses found in the Google Sheet.");
      }
    } catch (err) {
      console.error("Google Sheet Fetch Error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to fetch Google Sheet data.");
    } finally {
      setIsFetchingSheet(false);
    }
  };

  // Handle Local Sheet / Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const extractedEmails: string[] = [];
        data.forEach((row) => {
          Object.entries(row).forEach(([_, val]) => {
            if (typeof val === "string" && val.includes("@")) {
              const cleaned = val.trim().toLowerCase();
              if (!extractedEmails.includes(cleaned)) {
                extractedEmails.push(cleaned);
              }
            }
          });
        });

        if (extractedEmails.length > 0) {
          setParsedEmails(extractedEmails);
          toast.success(`Loaded ${extractedEmails.length} candidate emails from sheet file!`);
        } else {
          toast.error("No valid email addresses found in the uploaded sheet.");
        }
      } catch (err) {
        console.error("Failed to parse sheet:", err);
        toast.error("Failed to parse sheet file.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleAddManualEmails = () => {
    if (!allowedEmailsText.trim()) return;
    const emails = allowedEmailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@") && !parsedEmails.includes(e));

    if (emails.length > 0) {
      setParsedEmails([...parsedEmails, ...emails]);
      setAllowedEmailsText("");
      toast.success(`Added ${emails.length} emails to authorized list.`);
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setParsedEmails(parsedEmails.filter((e) => e !== emailToRemove));
  };

  const handleCreateInterview = (e: React.FormEvent) => {
    e.preventDefault();

    const finalBatch = selectedBatch === "custom" ? customBatch : selectedBatch;
    if (!finalBatch.trim()) {
      toast.error("Please select or enter a batch name.");
      return;
    }

    if (parsedEmails.length === 0) {
      toast.error("Requirement: Please paste a Google Sheet link, upload a file, or add candidate emails!");
      return;
    }

    if (!slotStartTime || !slotEndTime) {
      toast.error("Requirement: Please set both Start Time and End Time for the time slot.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const generatedToken = `batch_int_${Math.random().toString(36).substring(2, 9)}`;
      
      const newSession: CustomInterviewSession = {
        id: generatedToken,
        title: interviewTitle,
        batch: finalBatch,
        role: interviewRole,
        durationMinutes: parseInt(durationMinutes, 10),
        cameraMandatory,
        allowedEmails: parsedEmails,
        slotStartTime,
        slotEndTime,
        skills,
        instructions,
        createdAt: new Date().toISOString(),
        questions: [
          {
            id: "q1",
            prompt: `[${finalBatch}] Explain key concepts relevant to ${interviewRole} and demonstrate your problem-solving approach.`,
            durationSeconds: 180,
          },
          {
            id: "q2",
            prompt: `How do you handle real-world challenges in ${skills.join(", ")} projects?`,
            durationSeconds: 180,
          },
          {
            id: "q3",
            prompt: "Describe a complex technical issue you recently solved and how you tested the solution.",
            durationSeconds: 180,
          },
        ],
      };

      saveCustomInterview(newSession);

      const link = `${window.location.origin}/interview/${generatedToken}`;
      setCreatedLink(link);
      setIsSubmitting(false);
      toast.success("Batch Interview Session Created Successfully!");
    }, 400);
  };

  const handleCopyLink = () => {
    if (createdLink) {
      navigator.clipboard.writeText(createdLink);
      setCopied(true);
      toast.success("Interview link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-full space-y-3 overflow-x-hidden text-xs">
      {/* Sleek Top Banner Bar */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-700 via-primary to-purple-800 py-2.5 px-4 text-primary-foreground shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight leading-none">Create Batch Wise Interview</h1>
            <p className="text-primary-foreground/80 text-[11px] font-medium mt-0.5">
              4 Requirements: Batch Selection · Mandatory Camera · Google Sheet URL / Whitelist · Enforced Time Slot
            </p>
          </div>
        </div>

        {!createdLink && (
          <Button
            type="button"
            onClick={handleCreateInterview}
            disabled={isSubmitting}
            size="sm"
            className="font-bold gap-1.5 h-8 text-xs bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-sm shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            {isSubmitting ? "Publishing..." : "Publish Session"}
          </Button>
        )}
      </div>

      {createdLink ? (
        /* Success Screen with Interview Link */
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-md">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <CardTitle className="text-lg font-bold">Batch Interview Session Published!</CardTitle>
            </div>
            <CardDescription className="text-xs">
              The interview room is now configured with camera enforcement, email whitelist, and time slot lock.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-card border border-border/70 text-xs">
              <div>
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">Batch Name</span>
                <span className="font-extrabold text-foreground">{selectedBatch === "custom" ? customBatch : selectedBatch}</span>
              </div>
              <div>
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">Camera Policy</span>
                <Badge variant="default" className="bg-red-500/10 text-red-600 text-[10px] font-bold">
                  🎥 Mandatory ON
                </Badge>
              </div>
              <div>
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">Sheet Whitelist</span>
                <Badge variant="secondary" className="font-bold text-[10px]">
                  👥 {parsedEmails.length} Emails Allowed
                </Badge>
              </div>
              <div>
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">Time Slot Window</span>
                <span className="font-semibold text-foreground text-[11px] block">
                  {new Date(slotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slotEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Candidate Access URL</Label>
              <div className="flex items-center gap-2">
                <Input value={createdLink} readOnly className="font-mono text-xs bg-background h-9" />
                <Button onClick={handleCopyLink} variant={copied ? "default" : "outline"} className="shrink-0 gap-1.5 h-9 px-4 text-xs font-bold">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border/50 py-2 px-4">
            <Button variant="ghost" size="sm" onClick={() => setCreatedLink(null)} className="text-xs">
              Create Another Session
            </Button>
            <Button size="sm" className="gap-1.5 font-bold text-xs" onClick={() => window.open(createdLink, "_blank")}>
              Preview Candidate Room <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        /* Form 2x2 Grid Compact */
        <form onSubmit={handleCreateInterview} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
            {/* REQUIREMENT 1: MENTOR BATCH WISE INTERVIEW */}
            <Card className="shadow-sm border-border/60 border-l-4 border-l-primary flex flex-col justify-between">
              <CardHeader className="py-2.5 px-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Users className="w-4 h-4" />
                    <CardTitle className="text-sm font-bold">1. Select Batch (Requirement 1)</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold">Req 1</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="font-semibold text-xs">Target Batch</Label>
                    <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                      <SelectTrigger className="h-8 text-xs font-medium">
                        <SelectValue placeholder="Choose batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESET_BATCHES.map((b) => (
                          <SelectItem key={b} value={b} className="text-xs">
                            {b}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-xs">+ Custom Batch...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedBatch === "custom" ? (
                    <div className="space-y-1">
                      <Label htmlFor="customBatch" className="font-semibold text-xs">Custom Batch Name</Label>
                      <Input
                        id="customBatch"
                        placeholder="e.g. Batch 04 AI"
                        value={customBatch}
                        onChange={(e) => setCustomBatch(e.target.value)}
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="font-semibold text-xs">Target Role</Label>
                      <Input
                        value={interviewRole}
                        onChange={(e) => setInterviewRole(e.target.value)}
                        placeholder="e.g. Junior Web Developer"
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="interviewTitle" className="font-semibold text-xs">Interview Session Title</Label>
                  <Input
                    id="interviewTitle"
                    value={interviewTitle}
                    onChange={(e) => setInterviewTitle(e.target.value)}
                    placeholder="e.g. Batch 01 Technical Assessment"
                    className="h-8 text-xs"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* REQUIREMENT 2: VIDEO INTERVIEW & CAMERA MANDATORY */}
            <Card className="shadow-sm border-border/60 border-l-4 border-l-red-500 flex flex-col justify-between">
              <CardHeader className="py-2.5 px-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <Camera className="w-4 h-4" />
                    <CardTitle className="text-sm font-bold">2. Video & Camera Policy (Requirement 2)</CardTitle>
                  </div>
                  <Badge variant="destructive" className="text-[9px] font-bold uppercase">Mandatory</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-foreground">Camera ON Mandatory</span>
                      <Badge variant="destructive" className="text-[8px] uppercase font-bold py-0 h-4">Enforced</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Candidates must enable video camera permissions before entering.
                    </p>
                  </div>
                  <Switch
                    checked={cameraMandatory}
                    onCheckedChange={setCameraMandatory}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="font-semibold text-xs">Individual Interview Duration</Label>
                  <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15" className="text-xs">15 Minutes</SelectItem>
                      <SelectItem value="30" className="text-xs">30 Minutes</SelectItem>
                      <SelectItem value="45" className="text-xs">45 Minutes</SelectItem>
                      <SelectItem value="60" className="text-xs">60 Minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* REQUIREMENT 3: GOOGLE SHEET LINK & EMAIL WHITELIST */}
            <Card className="shadow-sm border-border/60 border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <CardHeader className="py-2.5 px-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="w-4 h-4" />
                    <CardTitle className="text-sm font-bold">3. Google Sheet Link / Whitelist (Requirement 3)</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold">Req 3</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-2.5">
                {/* Google Sheet URL Fetcher */}
                <div className="space-y-1">
                  <Label className="font-semibold text-xs flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-emerald-500" /> Google Sheet URL (Anyone with link view/editor)
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/ID/edit..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      className="h-8 text-[11px] font-mono"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleFetchGoogleSheet}
                      disabled={isFetchingSheet}
                      className="shrink-0 h-8 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3"
                    >
                      {isFetchingSheet ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" /> Fetching...
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 mr-1" /> Fetch Sheet Data
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Ensure link access is set to &quot;Anyone with the link can view&quot; or &quot;Editor&quot;.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                  <input
                    type="file"
                    id="sheetUpload"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="sheetUpload" className="cursor-pointer flex-1 border border-dashed border-emerald-500/40 rounded-md p-1.5 flex items-center justify-center gap-1.5 hover:bg-emerald-500/5 transition-colors">
                    <Upload className="w-3 h-3 text-emerald-500" />
                    <span className="font-bold text-[11px] text-foreground">Or Upload Local Excel / CSV File</span>
                  </label>
                  {uploadedFileName && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-bold text-[10px] truncate max-w-[120px]">
                      📄 {uploadedFileName}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-500" /> Whitelisted Student Emails ({parsedEmails.length})
                    </Label>
                    {parsedEmails.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setParsedEmails([])}
                        className="text-[10px] text-red-500 hover:underline font-semibold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1 bg-muted/20 rounded-md border border-border/50 scrollbar-thin">
                    {parsedEmails.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">No emails loaded yet. Fetch Google Sheet link above.</p>
                    ) : (
                      parsedEmails.map((email) => (
                        <Badge key={email} variant="outline" className="text-[10px] bg-background gap-0.5 font-mono py-0 px-1.5 h-4.5">
                          {email}
                          <button
                            type="button"
                            onClick={() => handleRemoveEmail(email)}
                            className="text-muted-foreground hover:text-red-500 ml-1"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* REQUIREMENT 4: INTERVIEW TIME SLOT ENFORCEMENT */}
            <Card className="shadow-sm border-border/60 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <CardHeader className="py-2.5 px-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                    <CardTitle className="text-sm font-bold">4. Interview Time Slot Window (Requirement 4)</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[9px] font-bold">Req 4</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="slotStartTime" className="font-semibold text-xs">
                      Time Slot Start <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="slotStartTime"
                        type="datetime-local"
                        value={slotStartTime}
                        onChange={(e) => setSlotStartTime(e.target.value)}
                        className="pl-8 h-8 text-xs font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="slotEndTime" className="font-semibold text-xs">
                      Time Slot End <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Clock className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        id="slotEndTime"
                        type="datetime-local"
                        value={slotEndTime}
                        onChange={(e) => setSlotEndTime(e.target.value)}
                        className="pl-8 h-8 text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Enforces entry window between Start & End time.</span>
                  <Badge variant="outline" className="text-[9px] font-bold border-amber-500/30 text-amber-600">
                    Time Locked
                  </Badge>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Submit Button Row */}
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={isSubmitting} size="sm" className="font-bold gap-1.5 px-6 h-9 text-xs">
              {isSubmitting ? (
                <span>Publishing Interview Session...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" /> Publish Batch Interview Session
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
