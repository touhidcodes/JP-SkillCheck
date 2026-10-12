"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Video, Sparkles, Clock, Calendar, Copy, Check, ExternalLink, 
  Plus, Users, Camera, Lock, ShieldCheck, Search, Filter, Eye
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getCustomInterviews, type CustomInterviewSession } from "@/lib/interviews/custom-session";

export function CreatedInterviewsView() {
  const [sessions, setSessions] = useState<CustomInterviewSession[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEmailsId, setExpandedEmailsId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getCustomInterviews();
    setSessions(Object.values(loaded));
  }, []);

  const handleCopyLink = (id: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/interview/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast.success("Candidate interview link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.batch.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.allowedEmails.some((e) => e.toLowerCase().includes(q))
    );
  });

  const getSlotStatus = (startStr: string, endStr: string) => {
    const now = Date.now();
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();

    if (now < start) {
      return { label: "Upcoming", variant: "outline" as const, color: "text-amber-500 border-amber-500/30 bg-amber-500/10" };
    }
    if (now > end) {
      return { label: "Expired", variant: "secondary" as const, color: "text-slate-400 border-slate-700 bg-slate-800" };
    }
    return { label: "Active Now", variant: "default" as const, color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 font-bold" };
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden text-xs pb-8">
      {/* Top Header Banner */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-700 via-primary to-purple-800 py-3 px-5 text-primary-foreground shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight leading-none">Created Batch Interviews</h1>
            <p className="text-primary-foreground/80 text-xs font-medium mt-1">
              Manage published sessions, whitelisted student emails, time slots, and access links.
            </p>
          </div>
        </div>

        <Link href="/mentor/create-interview">
          <Button size="sm" className="font-bold gap-1.5 h-9 text-xs bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-sm">
            <Plus className="w-4 h-4 text-slate-950" />
            Create New Interview
          </Button>
        </Link>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between gap-3 bg-card p-2.5 rounded-xl border border-border/60 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by title, batch, role, or candidate email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs bg-background"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span>Showing {filteredSessions.length} sessions</span>
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-border/70 space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Created Interviews Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create your first batch interview with mandatory camera, Google Sheet email access, and time slots.
          </p>
          <Link href="/mentor/create-interview">
            <Button size="sm" className="font-bold gap-1.5 mt-2">
              <Plus className="w-4 h-4" /> Create Interview Now
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((session) => {
            const status = getSlotStatus(session.slotStartTime, session.slotEndTime);
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const candidateUrl = `${origin}/interview/${session.id}`;

            return (
              <Card key={session.id} className="shadow-sm border-border/60 flex flex-col justify-between hover:border-primary/40 transition-colors">
                <CardHeader className="py-3 px-4 border-b border-border/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="font-bold text-[10px] bg-primary/5 text-primary border-primary/20">
                      {session.batch}
                    </Badge>
                    <Badge className={`text-[10px] uppercase font-bold border ${status.color}`}>
                      {status.label}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">{session.title}</CardTitle>
                    <CardDescription className="text-xs">{session.role} · {session.durationMinutes} Mins</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  {/* Key Metadata Badges */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Camera className="w-3 h-3 text-red-500" /> Camera Policy
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400 block text-[11px]">
                        🎥 Mandatory ON
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-muted/30 border border-border/40 space-y-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-500" /> Whitelist Access
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[11px]">
                        👥 {session.allowedEmails.length} Students Allowed
                      </span>
                    </div>
                  </div>

                  {/* Time Slot Window */}
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-1">
                    <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5" /> Enforced Time Slot Window
                    </span>
                    <div className="text-[11px] font-mono text-foreground">
                      {new Date(session.slotStartTime).toLocaleString()} <span className="text-muted-foreground">to</span> {new Date(session.slotEndTime).toLocaleString()}
                    </div>
                  </div>

                  {/* Whitelisted Emails Preview Dropdown */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setExpandedEmailsId(expandedEmailsId === session.id ? null : session.id)}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      {expandedEmailsId === session.id ? "Hide Whitelisted Emails" : `View Whitelisted Emails (${session.allowedEmails.length})`}
                    </button>

                    {expandedEmailsId === session.id && (
                      <div className="flex flex-wrap gap-1 p-2 bg-muted/30 rounded-lg border border-border/50 max-h-24 overflow-y-auto scrollbar-thin">
                        {session.allowedEmails.map((e) => (
                          <Badge key={e} variant="outline" className="text-[10px] font-mono bg-background">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="py-2.5 px-4 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant={copiedId === session.id ? "default" : "outline"}
                    onClick={() => handleCopyLink(session.id)}
                    className="h-8 text-xs font-bold gap-1.5 shrink-0"
                  >
                    {copiedId === session.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === session.id ? "Copied" : "Copy Access Link"}
                  </Button>

                  <Button
                    size="sm"
                    className="h-8 text-xs font-bold gap-1.5"
                    onClick={() => window.open(candidateUrl, "_blank")}
                  >
                    Preview Room <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
