"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { PublicInterviewTemplate } from "@/lib/interviews/catalog";

type Phase = "setup" | "active" | "scoring" | "complete";
type Evaluation = {
  resultId: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
};

export function InterviewRoom({ interview }: { interview: PublicInterviewTemplate }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [apiKey, setApiKey] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(interview.durationMinutes * 60);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});

  const finishInterview = useCallback(async (finalAnswers: Record<string, string>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("scoring");
    setError("");

    try {
      const response = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          interviewId: interview.id,
          answers: interview.questions.map((question) => ({
            questionId: question.id,
            answer: finalAnswers[question.id] || "",
          })),
        }),
      });
      const payload = await response.json() as Evaluation & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Could not score the interview.");
      setEvaluation(payload);
      setApiKey("");
      setPhase("complete");
    } catch (caught) {
      submittingRef.current = false;
      setError(caught instanceof Error ? caught.message : "Could not score the interview.");
      setSecondsLeft((current) => Math.max(current, 60));
      setAnswer(finalAnswers[interview.questions[questionIndex].id] || "");
      setPhase("active");
    }
  }, [apiKey, interview.id, interview.questions, questionIndex]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void finishInterview(answersRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finishInterview, phase]);

  function startInterview() {
    if (apiKey.trim().length < 10) {
      setError("Enter a valid Gemini API key to continue.");
      return;
    }
    setError("");
    setPhase("active");
  }

  function submitAnswer() {
    const question = interview.questions[questionIndex];
    const updated = { ...answersRef.current, [question.id]: answer.trim() };
    answersRef.current = updated;
    setAnswer("");

    if (questionIndex === interview.questions.length - 1) {
      void finishInterview(updated);
    } else {
      setQuestionIndex((current) => current + 1);
    }
  }

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = phase === "complete" ? 100 : ((questionIndex + 1) / interview.questions.length) * 100;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">SkillCheck</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{interview.title}</h1>
            <p className="mt-2 text-slate-400">{interview.role}</p>
          </div>
          {phase !== "setup" && phase !== "complete" && (
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-base">
              <Clock3 className="size-4 text-indigo-400" /> {minutes}:{seconds}
            </div>
          )}
        </div>

        {phase === "setup" && (
          <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
            <CardHeader className="px-6 pt-3 sm:px-8">
              <CardTitle className="text-xl">Ready to begin?</CardTitle>
              <CardDescription className="text-base text-slate-400">
                {interview.questions.length} predefined questions · {interview.durationMinutes} minutes · one AI scoring request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-4 sm:px-8">
              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-slate-200">Gemini API key</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 size-4 text-slate-500" />
                  <Input
                    id="api-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste your Gemini API key"
                    className="h-11 border-slate-700 bg-slate-950 pl-10 text-base text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-emerald-900/70 bg-emerald-950/40 p-4 text-sm leading-6 text-emerald-100">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                <p>Your key stays in this browser session, is sent to Gemini only when scoring, and is never saved. Answers are also not saved.</p>
              </div>

              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
              <Button onClick={startInterview} size="lg" className="h-11 w-full bg-indigo-500 text-base hover:bg-indigo-400">
                Start interview
              </Button>
            </CardContent>
          </Card>
        )}

        {(phase === "active" || phase === "scoring") && (
          <div className="space-y-5">
            <Progress value={progress} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-slate-800 [&_[data-slot=progress-indicator]]:bg-indigo-500" />
            <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
              <CardHeader className="px-6 pt-3 sm:px-8">
                <p className="text-sm font-medium text-indigo-400">Question {questionIndex + 1} of {interview.questions.length}</p>
                <CardTitle className="pt-2 text-xl leading-8 sm:text-2xl">
                  {interview.questions[questionIndex].prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-4 sm:px-8">
                <Textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  maxLength={4000}
                  disabled={phase === "scoring"}
                  placeholder="Type your answer here..."
                  className="min-h-48 resize-y border-slate-700 bg-slate-950 p-4 text-base leading-7 text-slate-100"
                />
                {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">{answer.length.toLocaleString()} characters</p>
                  <Button onClick={submitAnswer} disabled={phase === "scoring" || !answer.trim()} size="lg" className="h-10 bg-indigo-500 px-5 hover:bg-indigo-400">
                    {phase === "scoring" ? <><Loader2 className="animate-spin" /> Scoring…</> : questionIndex === interview.questions.length - 1 ? "Finish & score" : "Save & next"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {phase === "complete" && evaluation && (
          <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
            <CardHeader className="items-center px-6 pt-5 text-center sm:px-8">
              <CheckCircle2 className="mb-2 size-10 text-emerald-400" />
              <CardDescription className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Interview complete</CardDescription>
              <CardTitle className="text-5xl font-bold text-white">{evaluation.score}<span className="text-2xl text-slate-500">/100</span></CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-6 pb-5 sm:px-8">
              <p className="text-base leading-7 text-slate-300">{evaluation.summary}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <ResultList title="Strengths" items={evaluation.strengths} tone="emerald" />
                <ResultList title="Improve next" items={evaluation.improvements} tone="amber" />
              </div>
              <p className="text-center text-xs text-slate-500">Result saved · Reference {evaluation.resultId.slice(0, 8)}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function ResultList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "amber" }) {
  const styles = tone === "emerald"
    ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
    : "border-amber-900/60 bg-amber-950/30 text-amber-300";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </div>
  );
}
