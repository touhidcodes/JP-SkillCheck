"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"candidate" | "mentor">("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const session = {
      email: email.trim() || (role === "mentor" ? "mentor@example.com" : "student1@example.com"),
      name: email.split("@")[0] || (role === "mentor" ? "Mentor Lead" : "Candidate Student"),
      role: role === "mentor" ? "mentor" : "student",
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email || "demo")}`,
    };

    localStorage.setItem("skillcheck_user_session", JSON.stringify(session));
    fetch("/api/auth/save-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: session.email, name: session.name, role: session.role }),
    }).catch(() => {});

    setTimeout(() => {
      setLoading(false);
      router.push(role === "mentor" ? "/mentor" : "/interview/batch_01_frontend");
    }, 600);
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-7 text-center lg:text-left">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Welcome back</p>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Sign in to PlacementKit</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Continue your interview preparation or manage candidate assessments.</p>
      </div>

      <div className="rounded-3xl border border-border/80 bg-card/95 p-5 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)] backdrop-blur sm:p-7">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={role === "candidate"}
            onClick={() => setRole("candidate")}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${role === "candidate" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <GraduationCap className="size-4" /> Candidate
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === "mentor"}
            onClick={() => setRole("mentor")}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${role === "mentor" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ShieldCheck className="size-4" /> Mentor / Admin
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <GoogleAuthButton
            onAuthChange={(userSession) => {
              if (userSession) router.push(role === "mentor" ? "/mentor" : "/interview/batch_01_frontend");
            }}
          />
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">or use email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-bold">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={role === "mentor" ? "mentor@example.com" : "student@example.com"}
                className="h-11 rounded-xl border-border bg-background pl-10 text-sm shadow-none focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-11 rounded-xl border-border bg-background pl-10 pr-11 text-sm shadow-none focus-visible:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500">
            {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Signing in…</> : `Sign in as ${role === "mentor" ? "Mentor" : "Candidate"}`}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New to PlacementKit?{" "}
          <Link href="/register" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">Create an account</Link>
        </p>
      </div>

      <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">
        By continuing, you agree to use PlacementKit responsibly for interview preparation.
      </p>
    </div>
  );
}
