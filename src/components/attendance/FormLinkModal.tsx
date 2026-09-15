"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useAttendanceFormDetail,
  useDeactivateForm,
} from "@/hooks/use-attendance-forms";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";

interface FormLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  publicUrl: string;
  expiresAt: string;
  sessionLabel: string;
}

export function FormLinkModal({
  open,
  onOpenChange,
  formId,
  publicUrl,
  expiresAt,
  sessionLabel,
}: FormLinkModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const { data: formDetail } = useAttendanceFormDetail(formId, open);
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateForm();

  const submissionCount = formDetail?.submission_count ?? 0;
  const isExpired = isPast(parseISO(expiresAt));

  useEffect(() => {
    if (canvasRef.current && publicUrl && open) {
      QRCode.toCanvas(canvasRef.current, publicUrl, {
        width: 160,
        margin: 1,
      }).catch(() => {
        // Silent fail: the link is still copyable.
      });
    }
  }, [publicUrl, open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = publicUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopied(true);
    toast.success("Link copied to clipboard");
    window.setTimeout(() => setCopied(false), 2000);
  }

  function handleDeactivate() {
    deactivate(
      { id: formId },
      {
        onSuccess: () => {
          toast.success("Attendance form closed");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to close form. Please try again."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl border border-border/60 bg-card shadow-lg gap-0">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            Attendance Form Created
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Share this link with students to collect attendance for <strong>{sessionLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-5 pr-1">
          <div className="flex gap-2 items-center">
            <Input readOnly value={publicUrl} className="text-xs font-mono rounded-xl h-10 border-border/50" />
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopy}
              aria-label="Copy public link"
              title="Copy public link"
              className="h-10 w-10 shrink-0 rounded-xl"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex justify-center py-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <canvas
              ref={canvasRef}
              className="hidden rounded border sm:block bg-white"
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-2">
            <span>
              {isExpired ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <>
                  Expires{" "}
                  {formatDistanceToNow(parseISO(expiresAt), {
                    addSuffix: true,
                  })}
                </>
              )}
            </span>
            <Badge variant="secondary" className="rounded-md">
              {submissionCount}{" "}
              {submissionCount === 1 ? "submission" : "submissions"}
            </Badge>
          </div>

          {!isExpired && (
            <Button
              variant="destructive"
              size="sm"
              className="w-full font-bold rounded-xl h-10 transition-colors"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              <X className="h-4 w-4 mr-2" />
              Close Form Early
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
