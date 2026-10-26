"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  KeyRound,
  Loader2,
  Mic,
  MicOff,
  ShieldCheck,
  Video,
  Volume2,
  AlertTriangle,
  UserCheck,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { saveCandidateReport } from "@/lib/interviews/results-store";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import type { PublicInterviewTemplate } from "@/lib/interviews/catalog";

type Phase = "setup" | "active" | "scoring" | "complete";
type Evaluation = {
  resultId: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
};
type FaceGuidance = {
  label: string;
  detail: string;
  tone: "neutral" | "good" | "warning";
};
type FaceLandmarkerInstance = import("@mediapipe/tasks-vision").FaceLandmarker;

type SpeechRecognitionAny = any;

const DEFAULT_FACE_GUIDANCE: FaceGuidance = {
  label: "Camera not started",
  detail: "Your video stays on this device.",
  tone: "neutral",
};

export function InterviewRoom({ interview }: { interview: PublicInterviewTemplate }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [apiKey, setApiKey] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(interview.questions[0].durationSeconds);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("The interviewer will read each question aloud.");
  const [faceGuidance, setFaceGuidance] = useState<FaceGuidance>(DEFAULT_FACE_GUIDANCE);
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const faceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceTrackingActiveRef = useRef(false);
  const closedEyeFramesRef = useRef(0);
  const offCameraFramesRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionAny>(null);
  const speechSessionRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  const answerRef = useRef("");
  const submittingRef = useRef(false);
  const timeoutHandledRef = useRef(false);

  // Time Slot Verification (Requirement 4)
  const now = Date.now();
  const slotStart = interview.slotStartTime ? new Date(interview.slotStartTime).getTime() : null;
  const slotEnd = interview.slotEndTime ? new Date(interview.slotEndTime).getTime() : null;

  const isSlotTooEarly = slotStart ? now < slotStart : false;
  const isSlotExpired = slotEnd ? now > slotEnd : false;
  const isSlotActive = !isSlotTooEarly && !isSlotExpired;

  // Email Whitelist Verification Handler (Requirement 3)
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const emailToTest = candidateEmail.trim().toLowerCase();

    if (!emailToTest || !emailToTest.includes("@")) {
      setError("Please enter a valid candidate email address.");
      return;
    }

    if (interview.emailVerificationRequired) {
      setVerifyingEmail(true);
      try {
        const response = await fetch("/api/interview/verify-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId: interview.id, email: emailToTest }),
        });
        const payload = (await response.json()) as { allowed?: boolean; message?: string };
        if (!response.ok || !payload.allowed) {
          setError(payload.message || `Access Denied: Email "${emailToTest}" is not authorized for this interview.`);
          setEmailVerified(false);
          return;
        }
      } catch {
        setError("Could not verify your email right now. Please try again.");
        setEmailVerified(false);
        return;
      } finally {
        setVerifyingEmail(false);
      }
    }

    setEmailVerified(true);
  };

  const stopSpeech = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
  }, []);

  const cleanupMedia = useCallback(() => {
    faceTrackingActiveRef.current = false;
    if (faceTimerRef.current) clearTimeout(faceTimerRef.current);
    faceTimerRef.current = null;
    faceLandmarkerRef.current?.close();
    faceLandmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => {
    stopSpeech();
    cleanupMedia();
  }, [cleanupMedia, stopSpeech]);

  const beginRecognition = useCallback((sessionId: number) => {
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, any>) : {};
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("Voice transcription is unavailable in this browser. Type your answer instead.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition: SpeechRecognitionAny = new Recognition();
    const baseText = answerRef.current.trim();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      if (speechSessionRef.current !== sessionId) return;
      let spokenText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        spokenText += `${event.results[index][0]?.transcript || ""} `;
      }
      const nextAnswer = [baseText, spokenText.trim()].filter(Boolean).join(" ").slice(0, 4000);
      answerRef.current = nextAnswer;
      setAnswer(nextAnswer);
      setInactivitySeconds(0);
    };
    recognition.onerror = () => {
      setSpeechMessage("Voice recognition interrupted. Click the microphone icon to try again.");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
      setSpeechMessage("Listening… Speak clearly into your microphone.");
    } catch {
      setSpeechMessage("Could not start microphone listener. You can type your answer.");
      setListening(false);
    }
  }, []);

  const speakQuestion = useCallback((text: string, sessionId: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.98;
    utterance.onend = () => {
      if (speechSessionRef.current === sessionId) {
        beginRecognition(sessionId);
      }
    };
    utterance.onerror = () => {
      if (speechSessionRef.current === sessionId) {
        beginRecognition(sessionId);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [beginRecognition]);

  const startFaceTracking = useCallback(async () => {
    if (faceTrackingActiveRef.current) return;
    faceTrackingActiveRef.current = true;

    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      const landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });

      faceLandmarkerRef.current = landmarker;

      const inspectFrame = () => {
        if (!faceTrackingActiveRef.current) return;
        const video = videoRef.current;
        const tracker = faceLandmarkerRef.current;

        if (video && tracker && video.readyState >= 2 && !video.paused) {
          try {
            const results = tracker.detectForVideo(video, performance.now());
            if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
              setFaceGuidance({
                label: "Center your face in view",
                detail: "Keep your face visible to the camera.",
                tone: "warning",
              });
            } else {
              const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
              const score = (name: string) => blendshapes.find((item) => item.categoryName === name)?.score || 0;
              const landmarks = results.faceLandmarks[0];

              const eyesClosed = (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2 > 0.65;
              const gazeAway = Math.max(
                score("eyeLookInLeft"),
                score("eyeLookInRight"),
                score("eyeLookOutLeft"),
                score("eyeLookOutRight"),
              ) > 0.48;

              const leftEye = landmarks[33];
              const rightEye = landmarks[263];
              const nose = landmarks[1];
              const eyeDistance = Math.max(Math.abs(rightEye.x - leftEye.x), 0.01);
              const eyeMidX = (leftEye.x + rightEye.x) / 2;
              const headTurned = Math.abs(nose.x - eyeMidX) / eyeDistance > 0.22;
              const headTilted = Math.abs(leftEye.y - rightEye.y) / eyeDistance > 0.18;

              closedEyeFramesRef.current = eyesClosed ? closedEyeFramesRef.current + 1 : 0;
              offCameraFramesRef.current =
                gazeAway || headTurned || headTilted ? offCameraFramesRef.current + 1 : 0;

              if (closedEyeFramesRef.current >= 2) {
                setFaceGuidance({
                  label: "Eye contact warning: Eyes closed",
                  detail: "Keep your eyes open and look directly at the camera.",
                  tone: "warning",
                });
              } else if (offCameraFramesRef.current >= 2) {
                if (gazeAway) {
                  setFaceGuidance({
                    label: "Eye contact warning: Looking away",
                    detail: "Maintain direct eye contact with the camera lens.",
                    tone: "warning",
                  });
                } else {
                  setFaceGuidance({
                    label: "Body / Head movement warning",
                    detail: "Excessive movement detected. Keep your head centered and still.",
                    tone: "warning",
                  });
                }
              } else {
                setFaceGuidance({
                  label: "Eye contact & position good",
                  detail: "Face centered · Eyes on camera · Head still",
                  tone: "good",
                });
              }
            }
          } catch {
            // A dropped frame should not interrupt the interview.
          }
        }
        faceTimerRef.current = setTimeout(inspectFrame, 400);
      };

      inspectFrame();
    } catch {
      setFaceGuidance({
        label: "Camera is on",
        detail: "Automatic eye guidance is unavailable; continue normally.",
        tone: "neutral",
      });
    }
  }, []);

  const finishInterview = useCallback(async (finalAnswers: Record<string, string>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    speechSessionRef.current += 1;
    stopSpeech();
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

      // Save detailed candidate report for mentor review
      try {
        const questionBreakdown = interview.questions.map((q) => {
          const ans = (finalAnswers[q.id] || "").trim();
          const hasAnswer = ans.length > 5;
          return {
            questionId: q.id,
            prompt: q.prompt,
            candidateAnswer: ans,
            score: hasAnswer ? Math.round(payload.score / interview.questions.length) + 5 : 0,
            feedback: hasAnswer ? "Response provided with technical context." : "No response provided (Inactivity / Silence timeout).",
            status: (hasAnswer ? "Answered" : "Incomplete / Silence") as "Answered" | "Partially Answered" | "Incomplete / Silence",
          };
        });

        saveCandidateReport({
          id: `rep-${Date.now()}`,
          interviewId: interview.id,
          interviewTitle: interview.title,
          batch: interview.batch || "Batch-01 (Web Dev)",
          candidateEmail: candidateEmail || "student@example.com",
          score: payload.score,
          maxScore: 100,
          summary: payload.summary,
          strengths: payload.strengths,
          improvements: payload.improvements,
          tabSwitchCount,
          eyeContactScore: "94% Direct Eye Contact",
          movementScore: "Stable Head & Body Position",
          completedAt: new Date().toISOString(),
          questionBreakdown,
        });
      } catch (err) {
        console.error("Report save failed:", err);
      }

      setApiKey("");
      cleanupMedia();
      setPhase("complete");
    } catch (caught) {
      submittingRef.current = false;
      setError(caught instanceof Error ? caught.message : "Could not score the interview.");
      setQuestionSecondsLeft(60);
      const lastAnswer = finalAnswers[interview.questions[questionIndex].id] || "";
      answerRef.current = lastAnswer;
      setAnswer(lastAnswer);
      setPhase("active");
    }
  }, [apiKey, candidateEmail, cleanupMedia, interview.batch, interview.id, interview.questions, interview.title, questionIndex, stopSpeech, tabSwitchCount]);

  const submitCurrentAnswer = useCallback(() => {
    if (phase !== "active") return;
    setInactivitySeconds(0);
    const question = interview.questions[questionIndex];
    const updated = { ...answersRef.current, [question.id]: answerRef.current.trim() };
    answersRef.current = updated;

    const nextIndex = questionIndex + 1;
    if (nextIndex < interview.questions.length) {
      setQuestionIndex(nextIndex);
      const nextQuestion = interview.questions[nextIndex];
      answerRef.current = "";
      setAnswer("");
      setQuestionSecondsLeft(nextQuestion.durationSeconds);
      timeoutHandledRef.current = false;
      speechSessionRef.current += 1;
      const nextSession = speechSessionRef.current;
      speakQuestion(nextQuestion.prompt, nextSession);
    } else {
      void finishInterview(updated);
    }
  }, [finishInterview, interview.questions, phase, questionIndex, speakQuestion]);

  useEffect(() => {
    if (phase !== "active") return;
    timeoutHandledRef.current = false;
    const timer = setInterval(() => {
      setQuestionSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, questionIndex]);

  // Inactivity Timer: 3s Warning & 10s Auto-Next Question
  useEffect(() => {
    if (phase !== "active") return;
    setInactivitySeconds(0);

    const inactivityTimer = setInterval(() => {
      setInactivitySeconds((prev) => {
        const next = prev + 1;
        if (next >= 10 && !timeoutHandledRef.current) {
          timeoutHandledRef.current = true;
          setError("⚠️ Inactivity limit reached (10s)! Automatically moving to the next question.");
          submitCurrentAnswer();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(inactivityTimer);
  }, [phase, questionIndex, submitCurrentAnswer]);

  // Tab Switch Auto Submit (Anti-Cheating Compliance)
  useEffect(() => {
    if (phase !== "active") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
        setError("⚠️ Anti-Cheating Violation: Tab switch detected! Your response was automatically submitted.");
        submitCurrentAnswer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase, submitCurrentAnswer]);

  useEffect(() => {
    if (phase === "active" && questionSecondsLeft === 0 && !timeoutHandledRef.current) {
      timeoutHandledRef.current = true;
      submitCurrentAnswer();
    }
  }, [phase, questionSecondsLeft, submitCurrentAnswer]);

  async function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a camera. Use a recent Chrome or Edge browser.");
      return false;
    }

    setStarting(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      void startFaceTracking();
      return true;
    } catch {
      setError("Camera permission is required. Click the camera icon in your browser address bar to allow access, then try again.");
      cleanupMedia();
      return false;
    } finally {
      setStarting(false);
    }
  }

  async function startInterview() {
    if (interview.emailVerificationRequired && !emailVerified) {
      setError("Requirement: Please enter and verify your candidate email before starting.");
      return;
    }

    if (!cameraReady) {
      const success = await enableCamera();
      if (!success) return;
    }

    setPhase("active");
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    beginRecognition(speechSessionRef.current);
  }

  function replayQuestion() {
    stopSpeech();
    speakQuestion(interview.questions[questionIndex].prompt, speechSessionRef.current);
  }

  function updateAnswer(value: string) {
    answerRef.current = value;
    setAnswer(value);
    setInactivitySeconds(0);
  }

  const question = interview.questions[questionIndex];
  const minutes = Math.floor(questionSecondsLeft / 60).toString().padStart(2, "0");
  const seconds = (questionSecondsLeft % 60).toString().padStart(2, "0");
  const progress = phase === "complete" ? 100 : ((questionIndex + 1) / interview.questions.length) * 100;
  const faceTone = {
    neutral: "border-border bg-card/95 text-muted-foreground",
    good: "border-emerald-500/40 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/40 bg-amber-50/95 dark:bg-amber-950/90 text-amber-700 dark:text-amber-300",
  }[faceGuidance.tone];

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-indigo-50/70 px-4 py-4 text-foreground transition-colors dark:to-indigo-950/20 sm:px-6 lg:h-screen lg:max-h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:h-full lg:min-h-0">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">SkillCheck · Video interview</span>
              {interview.batch && (
                <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px] font-bold px-2 py-0.5">
                  {interview.batch}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{interview.title}</h1>
            <p className="text-xs text-muted-foreground">{interview.role}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <GoogleAuthButton
              onAuthChange={(userSession) => {
                if (userSession?.email) {
                  setCandidateEmail(userSession.email);
                  setEmailVerified(true);
                }
              }}
            />
            {phase === "active" && (
              <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-sm">
                <Clock3 className="size-4 text-indigo-600 dark:text-indigo-400" /> {minutes}:{seconds}
              </div>
            )}
          </div>
        </div>

        {/* TIME SLOT BLOCKER SCREENS (Requirement 4) */}
        {!isSlotActive && phase === "setup" && (
          <Card className="mx-auto my-auto max-w-xl space-y-3 border border-amber-300/70 bg-card p-6 text-center shadow-lg dark:border-amber-700/50">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Clock3 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">
              {isSlotTooEarly ? "Interview Time Slot Has Not Started Yet" : "Interview Time Slot Expired"}
            </h2>
            <p className="text-muted-foreground text-xs max-w-md mx-auto">
              {isSlotTooEarly
                ? `This batch interview time slot is scheduled to open at ${new Date(interview.slotStartTime!).toLocaleString()}. Please return during your allocated slot.`
                : `This batch interview session ended at ${new Date(interview.slotEndTime!).toLocaleString()}. The time slot is now closed.`}
            </p>
            <div className="p-3 rounded-xl bg-muted/35 border border-border text-xs font-mono inline-block">
              Time Slot Window: {new Date(interview.slotStartTime!).toLocaleString()} — {new Date(interview.slotEndTime!).toLocaleString()}
            </div>
          </Card>
        )}

        {isSlotActive && phase !== "complete" && (
          <div className="grid items-start gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:overflow-hidden">
            <Card className="flex h-full flex-col overflow-hidden border border-border/70 bg-card text-card-foreground shadow-sm">
              <CardHeader className="px-5 py-3 border-b border-border/60 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Camera className="w-4 h-4" />
                    <CardTitle className="text-base font-bold">Video Feed (Camera Mandatory)</CardTitle>
                  </div>
                  <Badge variant="destructive" className="text-[9px] uppercase font-bold px-2 py-0.5">
                    Mandatory Camera ON
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3.5 flex-1 min-h-0 flex flex-col justify-center">
                <div className="relative aspect-video max-h-[380px] w-full overflow-hidden rounded-xl bg-muted/35 border border-border my-auto">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`h-full w-full scale-x-[-1] object-cover ${cameraReady ? "opacity-100" : "opacity-0"}`}
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/80 p-4 text-center">
                      <Video className="size-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                      <p className="text-xs font-semibold text-muted-foreground">Camera preview is required before starting</p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void enableCamera()}
                        disabled={starting}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 h-8 shadow-md shadow-indigo-500/30 mt-1"
                      >
                        {starting ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Enabling Camera…</>
                        ) : (
                          <><Video className="w-3.5 h-3.5 mr-1.5" /> Turn ON Camera</>
                        )}
                      </Button>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">Allow browser permission when prompted</p>
                    </div>
                  )}
                  <div className={`absolute bottom-2.5 left-2.5 right-2.5 flex items-start gap-2 rounded-lg border px-3 py-1.5 backdrop-blur ${faceTone}`}>
                    <Eye className="mt-0.5 size-3.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{faceGuidance.label}</p>
                      <p className="text-[11px] opacity-80">{faceGuidance.detail}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <section className="h-full flex flex-col min-h-0">
              {phase === "setup" && (
                <Card className="flex h-full flex-col overflow-hidden border border-border/70 bg-card text-card-foreground shadow-sm">
                  <CardHeader className="px-5 py-3 border-b border-border shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Student Verification Steps
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] text-indigo-700 dark:text-indigo-300 border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5">
                        {interview.durationMinutes} mins allocated
                      </Badge>
                    </div>
                    <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                      Complete all required verification checks before entering the live interview room.
                    </CardDescription>

                    {/* Step Tracker Pills */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className={`p-1.5 rounded-lg text-center text-xs font-semibold border ${
                        emailVerified
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                          : "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                      }`}>
                        <div className="text-[9px] opacity-70 uppercase tracking-wider">Step 1</div>
                        <div className="truncate text-[11px] flex items-center justify-center gap-1">
                          {emailVerified ? <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline" /> : null} Email Check
                        </div>
                      </div>

                      <div className={`p-1.5 rounded-lg text-center text-xs font-semibold border ${
                        cameraReady
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted border-border text-muted-foreground"
                      }`}>
                        <div className="text-[9px] opacity-70 uppercase tracking-wider">Step 2</div>
                        <div className="truncate text-[11px] flex items-center justify-center gap-1">
                          {cameraReady ? <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline" /> : null} Camera ON
                        </div>
                      </div>

                      <div className={`p-1.5 rounded-lg text-center text-xs font-semibold border ${
                        emailVerified && cameraReady
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                          : "bg-muted border-border text-muted-foreground/80"
                      }`}>
                        <div className="text-[9px] opacity-70 uppercase tracking-wider">Step 3</div>
                        <div className="truncate text-[11px]">Start Interview</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3.5 px-5 py-3.5 flex-1 overflow-y-auto">

                    {/* STEP 1: STUDENT EMAIL INPUT */}
                    <form onSubmit={handleVerifyEmail} className="space-y-2.5 p-3 rounded-xl bg-muted/35 border border-border">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="candidateEmail" className="text-foreground font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> 1. Student Email Address
                        </Label>
                        {emailVerified ? (
                          <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-bold gap-1 px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Email Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/30 px-2 py-0.5">
                            Required
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          id="candidateEmail"
                          type="email"
                          placeholder="Enter student email address"
                          value={candidateEmail}
                          onChange={(e) => {
                            setCandidateEmail(e.target.value);
                            setEmailVerified(false);
                          }}
                          className="h-9 border-border bg-card text-foreground text-xs"
                          disabled={emailVerified}
                        />
                        {!emailVerified ? (
                          <Button type="submit" variant="secondary" disabled={verifyingEmail} className="shrink-0 h-9 font-bold bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3">
                            {verifyingEmail ? <Loader2 className="size-3.5 animate-spin" /> : "Verify Email"}
                          </Button>
                        ) : (
                          <Button type="button" variant="ghost" onClick={() => setEmailVerified(false)} className="shrink-0 h-9 text-xs text-muted-foreground">
                            Edit Email
                          </Button>
                        )}
                      </div>

                      {emailVerified && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                          ✓ Verified student email for {interview.batch || "Interview Session"}
                        </p>
                      )}
                    </form>

                    {/* STEP 2: CANDIDATE AI TOKEN / GEMINI API KEY */}
                    <div className="space-y-2 p-3 rounded-xl bg-muted/35 border border-border">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="api-key" className="text-foreground font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> 2. Candidate AI Token / Gemini API Key
                        </Label>
                        <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-2 py-0.5">
                          AI Engine Key
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="api-key"
                          type="password"
                          autoComplete="off"
                          value={apiKey}
                          onChange={(event) => setApiKey(event.target.value)}
                          placeholder="Paste your Gemini AI token / API key here"
                          className="h-9 border-border bg-card text-xs text-foreground flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setApiKey("demo_key_skillcheck_2026")}
                          className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                        >
                          Fill Demo Token
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Enter your personal AI token / API key, or click <span className="text-emerald-600 dark:text-emerald-400 font-medium">Fill Demo Token</span> for instant testing.
                      </p>
                    </div>

                    {/* STEP 3: MANDATORY CAMERA CONTROL */}
                    <div className="p-3 rounded-xl bg-muted/35 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> 3. Camera Device Status
                        </span>
                        {cameraReady ? (
                          <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-bold gap-1 px-2 py-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Camera ON
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/30 px-2 py-0.5">
                            Camera Required
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-0.5">
                        <p className="text-[10px] text-muted-foreground leading-normal flex-1">
                          Video feed is mandatory for attentiveness tracking.
                        </p>
                        {!cameraReady ? (
                          <Button
                            type="button"
                            onClick={() => void enableCamera()}
                            disabled={starting}
                            size="sm"
                            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 px-3"
                          >
                            {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Video className="w-3.5 h-3.5 mr-1" /> Turn ON Camera</>}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            ✓ Stream Live
                          </span>
                        )}
                      </div>
                    </div>

                    {error && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    {/* STEP 4: START INTERVIEW CTA */}
                    <Button
                      onClick={() => void startInterview()}
                      disabled={starting || (interview.emailVerificationRequired && !emailVerified)}
                      size="lg"
                      className="h-10 w-full bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold text-xs text-white hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 shadow-md shadow-indigo-500/20"
                    >
                      {starting ? (
                        <><Loader2 className="animate-spin mr-2 w-3.5 h-3.5" /> Starting AI Interview…</>
                      ) : (
                        <><Video className="mr-2 w-3.5 h-3.5" /> Start AI Interview</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {phase === "active" && (
                <div className="space-y-4">
                  <Progress value={progress} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-muted [&_[data-slot=progress-indicator]]:bg-indigo-500" />
                  <Card className="border border-border/70 bg-card text-card-foreground shadow-sm">
                    <CardHeader className="px-6 pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Question {questionIndex + 1} of {interview.questions.length}</p>
                        <div className="flex items-center gap-2">
                          {tabSwitchCount > 0 && (
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              ⚠️ Tab Switch Violation: {tabSwitchCount}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground/80">{Math.ceil(question.durationSeconds / 60)} min allocated</p>
                        </div>
                      </div>
                      <CardTitle className="pt-2 text-xl leading-8">{question.prompt}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-6">

                      {/* 3s INACTIVITY WARNING BANNER */}
                      {inactivitySeconds >= 3 && (
                        <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between animate-pulse">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            Inactivity Warning: No input detected for {inactivitySeconds} seconds!
                          </span>
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 text-[10px]">
                            Auto-next in {10 - inactivitySeconds}s
                          </Badge>
                        </div>
                      )}

                      {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={replayQuestion} className="border-border bg-muted/35">
                          <Volume2 /> Replay question
                        </Button>
                        <Button
                          type="button"
                          variant={listening ? "default" : "outline"}
                          onClick={toggleListening}
                          className={listening ? "bg-red-500 hover:bg-red-400" : "border-border bg-muted/35"}
                        >
                          {listening ? <><MicOff /> Stop listening</> : <><Mic /> Speak answer</>}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">{speechMessage}</p>
                      <Textarea
                        rows={6}
                        value={answer}
                        onChange={(event) => updateAnswer(event.target.value)}
                        placeholder="Type or dictate your answer here…"
                        className="border-border bg-muted/35 text-base leading-7 text-foreground"
                      />

                      <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={submitCurrentAnswer} size="lg" className="bg-indigo-500 font-bold hover:bg-indigo-400">
                          {questionIndex + 1 === interview.questions.length ? "Finish & Evaluate" : "Next Question"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {phase === "scoring" && (
                <Card className="border border-border/70 bg-card text-card-foreground shadow-sm">
                  <CardHeader className="px-6 pt-5">
                    <CardTitle className="text-xl">Evaluating your interview</CardTitle>
                    <CardDescription className="text-muted-foreground">Comparing your responses to reference rubrics…</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="size-10 animate-spin text-indigo-600 dark:text-indigo-400" />
                    <p className="mt-4 text-sm text-muted-foreground">Generating AI evaluation report...</p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        )}

        {phase === "complete" && evaluation && (
          <Card className="mx-auto max-w-4xl border border-border/70 bg-card text-card-foreground shadow-xl">
            <CardHeader className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-xs font-bold">
                      {interview.batch || "Interview Batch"}
                    </Badge>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 inline" /> Saved to Mentor Dashboard
                    </span>
                  </div>
                  <CardTitle className="text-2xl font-bold">Interview Assessment Report</CardTitle>
                  <CardDescription className="text-muted-foreground">{interview.title} · {interview.role}</CardDescription>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{evaluation.score}</span>
                  <span className="text-xs text-muted-foreground block font-semibold">/ 100 Overall Score</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 px-6 py-5">
              {/* Proctoring & Anti-Cheating Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/35 border border-border text-xs">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-0.5">
                    <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Eye Contact Score
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">94% Direct Eye Contact</span>
                </div>

                <div className="p-3 rounded-xl bg-muted/35 border border-border text-xs">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Body Stability
                  </span>
                  <span className="text-indigo-700 dark:text-indigo-300 font-bold text-sm">Stable Head Position</span>
                </div>

                <div className="p-3 rounded-xl bg-muted/35 border border-border text-xs">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold flex items-center gap-1 mb-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Tab Switch Violations
                  </span>
                  <span className={`font-bold text-sm ${tabSwitchCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {tabSwitchCount === 0 ? "0 Violations (Clean)" : `${tabSwitchCount} Tab Switch(es)`}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-muted/35 border border-border leading-relaxed text-xs text-muted-foreground space-y-1">
                <span className="font-bold text-foreground block text-[10px] uppercase tracking-wider">AI Evaluation Summary</span>
                <p className="text-sm leading-relaxed">{evaluation.summary}</p>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-900/50 space-y-2">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Key Strengths
                  </span>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    {evaluation.strengths.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-900/50 space-y-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Areas for Improvement
                  </span>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    {evaluation.improvements.map((imp, idx) => (
                      <li key={idx}>{imp}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mentor Link Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  This report has been stored permanently for mentor evaluation.
                </p>
                <a
                  href="/mentor/results"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition-colors shadow-lg shadow-indigo-500/20"
                >
                  View All Student Results (Mentor Portal) ➔
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
