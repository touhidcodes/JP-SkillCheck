"use client";

import { useState } from "react";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateAttendanceForm } from "@/hooks/use-attendance-forms";
import { FormLinkModal } from "./FormLinkModal";

interface CreateFormButtonProps {
  sessionId: string;
  sessionLabel: string;
  date: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  topicTags: string;
  durationMinutes: number;
  expiryMinutes?: number;
}

interface CreatedForm {
  id: string;
  public_url: string;
  expires_at: string;
  session_label: string;
  date: string;
}

export function CreateFormButton({
  sessionId,
  sessionLabel,
  date,
  mode,
  period,
  topicTags,
  durationMinutes,
  expiryMinutes = 120,
}: CreateFormButtonProps) {
  const [createdForm, setCreatedForm] = useState<CreatedForm | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { mutate, isPending } = useCreateAttendanceForm();

  const isDisabled = !sessionId || isPending;

  function handleClick() {
    mutate(
      {
        session_id: sessionId,
        session_label: sessionLabel,
        date,
        mode,
        period,
        topic_tags: topicTags,
        duration_minutes: durationMinutes,
        expiry_minutes: expiryMinutes,
      },
      {
        onSuccess: (data: any) => {
          setCreatedForm(data as CreatedForm);
          setModalOpen(true);
        },
        onError: (error: any) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not create the attendance form. Please try again.",
          );
        },
      },
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isDisabled}
        variant="outline"
        size="sm"
        title={
          !sessionId
            ? "Configure a session in the Setup panel first"
            : "Create a shareable attendance form"
        }
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <LinkIcon className="h-4 w-4 mr-2" />
        )}
        <span className="hidden sm:inline">Create Attendance Form</span>
        <span className="sm:hidden">Form</span>
      </Button>

      {createdForm && (
        <FormLinkModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          formId={createdForm.id}
          publicUrl={createdForm.public_url}
          expiresAt={createdForm.expires_at}
          sessionLabel={createdForm.session_label}
        />
      )}
    </>
  );
}
