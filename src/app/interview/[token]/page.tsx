import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview/interview-room";
import { getInterviewTemplate, toPublicInterview } from "@/lib/interviews/catalog";

type PageProps = { params: { token: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const interview = getInterviewTemplate(params.token);
  return {
    title: interview ? `${interview.title} | SkillCheck` : "Interview | SkillCheck",
    description: "Complete a private, timed mock interview.",
  };
}

export default function InterviewPage({ params }: PageProps) {
  const interview = getInterviewTemplate(params.token);
  if (!interview) notFound();
  return <InterviewRoom interview={toPublicInterview(interview)} />;
}
