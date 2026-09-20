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
} from "lucide-react";
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
type FaceGuidance = {
  label: string;
  detail: string;
  tone: "neutral" | "good" | "warning";
};
type FaceLandmarkerInstance = import("@mediapipe/tasks-vision").FaceLandmarker;

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DEFAULT_FACE_GUIDANCE: FaceGuidance = {
  label: "Camera not started",
  detail: "Your video stays on this device.",
  tone: "neutral",
};

export function InterviewRoom({ interview }: { interview: PublicInterviewTemplate }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [apiKey, setApiKey] = useState("");
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const faceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceTrackingActiveRef = useRef(false);
  const closedEyeFramesRef = useRef(0);
  const offCameraFramesRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSessionRef = useRef(0);
  const answersRef = useRef<Record<string, string>>({});
  const answerRef = useRef("");
  const submittingRef = useRef(false);
  const timeoutHandledRef = useRef(false);

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
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechMessage("Voice transcription is unavailable in this browser. Type your answer instead.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    const baseText = answerRef.current.trim();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      if (speechSessionRef.current !== sessionId) return;
      let spokenText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        spokenText += `${event.results[index][0]?.transcript || ""} `;
      }
      const nextAnswer = [baseText, spokenText.trim()].filter(Boolean).join(" ").slice(0, 4000);
      answerRef.current = nextAnswer;
      setAnswer(nextAnswer);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setSpeechMessage("Microphone transcription stopped. You can restart it or type your answer.");
      }
    };
    recognition.onend = () => {
      if (speechSessionRef.current === sessionId) setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setSpeechMessage("Listening… Your transcript remains editable.");
    } catch {
      setListening(false);
    }
  }, []);

  const speakQuestion = useCallback((prompt: string, sessionId: number) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.lang.startsWith("en") && /Natural|Google/i.test(voice.name)) ||
      voices.find((voice) => voice.lang.startsWith("en")) ||
      null;
    utterance.onstart = () => setSpeechMessage("The interviewer is speaking…");
    utterance.onend = () => {
      if (speechSessionRef.current === sessionId) beginRecognition(sessionId);
    };
    utterance.onerror = () => {
      if (speechSessionRef.current === sessionId) beginRecognition(sessionId);
    };
    window.speechSynthesis.speak(utterance);
  }, [beginRecognition]);

  const startFaceTracking = useCallback(async () => {
    try {
      setFaceGuidance({
        label: "Loading camera guidance",
        detail: "Preparing local face landmarks…",
        tone: "neutral",
      });
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceLandmarkerRef.current = landmarker;
      faceTrackingActiveRef.current = true;

      const inspectFrame = () => {
        const video = videoRef.current;
        const activeLandmarker = faceLandmarkerRef.current;
        if (!faceTrackingActiveRef.current || !video || !activeLandmarker) return;

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            const result = activeLandmarker.detectForVideo(video, performance.now());
            const landmarks = result.faceLandmarks[0];
            const categories = result.faceBlendshapes[0]?.categories || [];

            if (!landmarks) {
              closedEyeFramesRef.current = 0;
              offCameraFramesRef.current += 1;
              setFaceGuidance({
                label: "Face not visible",
                detail: "Move into the frame and improve the lighting.",
                tone: "warning",
              });
            } else {
              const score = (name: string) =>
                categories.find((category) => category.categoryName === name)?.score || 0;
              const eyesClosed = score("eyeBlinkLeft") > 0.58 && score("eyeBlinkRight") > 0.58;
              const gazeAway = Math.max(
                score("eyeLookUpLeft"),
                score("eyeLookUpRight"),
                score("eyeLookDownLeft"),
                score("eyeLookDownRight"),
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
                  label: "Eyes appear closed",
                  detail: "Open your eyes naturally when you are ready.",
                  tone: "warning",
                });
              } else if (offCameraFramesRef.current >= 2) {
                setFaceGuidance({
                  label: "Look toward the camera",
                  detail: "Keep your head straight and camera near eye level.",
                  tone: "warning",
                });
              } else {
                setFaceGuidance({
                  label: "Camera position looks good",
                  detail: "Face visible · eyes open · looking forward",
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
  }, [apiKey, cleanupMedia, interview.id, interview.questions, questionIndex, stopSpeech]);

  const submitCurrentAnswer = useCallback(() => {
    if (phase !== "active") return;
    const question = interview.questions[questionIndex];
    const updated = { ...answersRef.current, [question.id]: answerRef.current.trim() };
    answersRef.current = updated;
    speechSessionRef.current += 1;
    stopSpeech();

    if (questionIndex === interview.questions.length - 1) {
      void finishInterview(updated);
    } else {
      setQuestionIndex((current) => current + 1);
    }
  }, [finishInterview, interview.questions, phase, questionIndex, stopSpeech]);

  useEffect(() => {
    if (phase !== "active") return;
    const question = interview.questions[questionIndex];
    const sessionId = speechSessionRef.current + 1;
    speechSessionRef.current = sessionId;
    timeoutHandledRef.current = false;
    stopSpeech();
    const existingAnswer = answersRef.current[question.id] || "";
    answerRef.current = existingAnswer;
    setAnswer(existingAnswer);
    setQuestionSecondsLeft(question.durationSeconds);
    setSpeechMessage("The interviewer will read the question aloud.");

    const speechDelay = window.setTimeout(() => speakQuestion(question.prompt, sessionId), 250);
    return () => {
      window.clearTimeout(speechDelay);
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    };
  }, [interview.questions, phase, questionIndex, speakQuestion, stopSpeech]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setInterval(() => {
      setQuestionSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, questionIndex]);

  useEffect(() => {
    if (phase === "active" && questionSecondsLeft === 0 && !timeoutHandledRef.current) {
      timeoutHandledRef.current = true;
      submitCurrentAnswer();
    }
  }, [phase, questionSecondsLeft, submitCurrentAnswer]);

  async function startInterview() {
    if (apiKey.trim().length < 10) {
      setError("Enter a valid Gemini API key to continue.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a camera. Use a recent Chrome or Edge browser.");
      return;
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
      setPhase("active");
      void startFaceTracking();
    } catch {
      setError("Camera permission is required for this interview. Allow access and try again.");
      cleanupMedia();
    } finally {
      setStarting(false);
    }
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
  }

  const question = interview.questions[questionIndex];
  const minutes = Math.floor(questionSecondsLeft / 60).toString().padStart(2, "0");
  const seconds = (questionSecondsLeft % 60).toString().padStart(2, "0");
  const progress = phase === "complete" ? 100 : ((questionIndex + 1) / interview.questions.length) * 100;
  const faceTone = {
    neutral: "border-slate-700 bg-slate-900/90 text-slate-300",
    good: "border-emerald-500/40 bg-emerald-950/90 text-emerald-300",
    warning: "border-amber-500/40 bg-amber-950/90 text-amber-300",
  }[faceGuidance.tone];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-7 text-slate-100 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">SkillCheck · Video interview</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{interview.title}</h1>
            <p className="mt-2 text-slate-400">{interview.role}</p>
          </div>
          {phase === "active" && (
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-base">
              <Clock3 className="size-4 text-indigo-400" /> {minutes}:{seconds}
            </div>
          )}
        </div>

        {phase !== "complete" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
              <CardContent className="relative px-3 pb-0 pt-0">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full scale-x-[-1] object-cover ${cameraReady ? "opacity-100" : "opacity-0"}`}
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Video className="size-10" />
                      <p className="text-sm">Camera preview appears here</p>
                    </div>
                  )}
                  <div className={`absolute bottom-3 left-3 right-3 flex items-start gap-2 rounded-lg border px-3 py-2 backdrop-blur ${faceTone}`}>
                    <Eye className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{faceGuidance.label}</p>
                      <p className="text-xs opacity-80">{faceGuidance.detail}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <section>
              {phase === "setup" && (
                <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
                  <CardHeader className="px-6 pt-3">
                    <CardTitle className="text-xl">Camera and voice setup</CardTitle>
                    <CardDescription className="text-base text-slate-400">
                      {interview.questions.length} spoken questions · {interview.durationMinutes} minutes maximum
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 px-6 pb-4">
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
                      <p>
                        Video and eye guidance run in your browser and are not recorded. The app saves no API key,
                        video, audio, transcript, or gaze data—only final marks and feedback.
                      </p>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">
                      Voice transcription uses your browser&apos;s speech service and may require microphone permission.
                      Camera guidance is approximate and does not affect your score.
                    </p>

                    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                    <Button
                      onClick={() => void startInterview()}
                      disabled={starting}
                      size="lg"
                      className="h-11 w-full bg-indigo-500 text-base hover:bg-indigo-400"
                    >
                      {starting ? <><Loader2 className="animate-spin" /> Starting camera…</> : <><Video /> Enable camera & start</>}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {phase === "active" && (
                <div className="space-y-4">
                  <Progress value={progress} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-slate-800 [&_[data-slot=progress-indicator]]:bg-indigo-500" />
                  <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
                    <CardHeader className="px-6 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-indigo-400">Question {questionIndex + 1} of {interview.questions.length}</p>
                        <p className="text-xs text-slate-500">{Math.ceil(question.durationSeconds / 60)} min allocated</p>
                      </div>
                      <CardTitle className="pt-2 text-xl leading-8">{question.prompt}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={replayQuestion} className="border-slate-700 bg-slate-950">
                          <Volume2 /> Replay question
                        </Button>
                        <Button
                          type="button"
                          variant={listening ? "default" : "outline"}
                          onClick={toggleListening}
                          className={listening ? "bg-red-500 hover:bg-red-400" : "border-slate-700 bg-slate-950"}
                        >
                          {listening ? <MicOff /> : <Mic />}
                          {listening ? "Stop listening" : "Start microphone"}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">{speechMessage}</p>
                      <Textarea
                        value={answer}
                        onChange={(event) => updateAnswer(event.target.value)}
                        maxLength={4000}
                        placeholder="Your spoken answer will appear here. You can also type…"
                        className="min-h-40 resize-y border-slate-700 bg-slate-950 p-4 text-base leading-7 text-slate-100"
                      />
                      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">{answer.length.toLocaleString()} / 4,000 characters</p>
                        <Button onClick={submitCurrentAnswer} className="bg-indigo-500 px-5 hover:bg-indigo-400">
                          {questionIndex === interview.questions.length - 1 ? "Finish & score" : "Save & next"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {phase === "scoring" && (
                <Card className="border-0 bg-slate-900 text-slate-100 ring-slate-800">
                  <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 text-center">
                    <Loader2 className="size-10 animate-spin text-indigo-400" />
                    <div>
                      <h2 className="text-xl font-semibold">Scoring your interview</h2>
                      <p className="mt-2 text-sm text-slate-400">Gemini is evaluating the answer transcripts once.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        )}

        {phase === "complete" && evaluation && (
          <Card className="mx-auto max-w-3xl border-0 bg-slate-900 text-slate-100 ring-slate-800">
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
