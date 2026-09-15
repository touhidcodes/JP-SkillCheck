"use client";

import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { KanbanBoard } from "@/components/dashboard/kanban-board";

export default function MentorPlacementPage() {
  const { data: stats } = useQuery({
    queryKey: ["placement-stats"],
    queryFn: async () => {
      const res = await fetch("/api/placement");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const stageLabels = [
    { key: "learning", label: "Learning", color: "bg-slate-500" },
    { key: "applying", label: "Applying", color: "bg-blue-500" },
    { key: "interviewing", label: "Interviewing", color: "bg-amber-500" },
    { key: "offer_pending", label: "Offer Pending", color: "bg-orange-500" },
    { key: "placed", label: "Placed", color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Placement Pipeline</h1>
        <TooltipProvider delay={0}>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <button className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors cursor-help">
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="max-w-sm p-3 shadow-lg border border-border/50 bg-background">
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-foreground">Placement Pipeline Overview</p>
                <p className="text-muted-foreground">Drag-and-drop Kanban board showing student progression through the job placement pipeline.</p>
                <ul className="text-muted-foreground space-y-1 ml-2">
                  <li>📚 <strong>Learning:</strong> Preparing for job search</li>
                  <li>📋 <strong>Applying:</strong> Submitting applications</li>
                  <li>🎤 <strong>Interviewing:</strong> In interview rounds</li>
                  <li>🎁 <strong>Offer Pending:</strong> Received offers</li>
                  <li>✅ <strong>Placed:</strong> Accepted job offers</li>
                </ul>
                <p className="text-muted-foreground mt-2"><strong>Tip:</strong> Drag student cards between columns to update their stage</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          {stageLabels.map(({ key, label, color }) => (
            <div
              key={key}
              className="flex items-center gap-2 bg-white border rounded-full px-4 py-2"
            >
              <span className={`w-3 h-3 rounded-full ${color}`} />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-sm text-muted-foreground">
                ({(stats as Record<string, number>)[key] || 0})
              </span>
            </div>
          ))}
        </div>
      )}

      <KanbanBoard readOnly={false} />
    </div>
  );
}
