"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, Video, UserCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"candidate" | "mentor">("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Store user session locally
    const session = {
      email: email.trim() || (role === "mentor" ? "mentor@example.com" : "student1@example.com"),
      name: email.split("@")[0] || (role === "mentor" ? "Mentor Lead" : "Candidate Student"),
      role: role === "mentor" ? "mentor" : "student",
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email || "demo")}`,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("skillcheck_user_session", JSON.stringify(session));
    }

    fetch("/api/auth/save-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: session.email,
        name: session.name,
        role: session.role,
      }),
    }).catch(() => {});

    setTimeout(() => {
      setLoading(false);
      if (role === "mentor") {
        router.push("/mentor");
      } else {
        router.push("/interview/batch_01_frontend");
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            <Video className="w-3.5 h-3.5" /> SkillCheck · AI Video Interview Platform
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Sign In to Your Account</h1>
          <p className="text-xs text-slate-400">
            Access live AI video mock interviews, evaluation reports, and batch tracking.
          </p>
        </div>

        <Card className="border-0 bg-slate-900 text-slate-100 ring-1 ring-slate-800 shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

          <CardHeader className="p-6 pb-4 border-b border-slate-800/80">
            <CardTitle className="text-lg font-bold text-center">Select Account Role</CardTitle>
            
            {/* Role Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRole("candidate")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  role === "candidate"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Candidate (Student)
              </button>

              <button
                type="button"
                onClick={() => setRole("mentor")}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  role === "mentor"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Mentor / Admin
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            
            {/* 1-Click Google Login Button */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block text-center">
                Fast 1-Click Authentication
              </span>
              <div className="flex justify-center">
                <GoogleAuthButton
                  onAuthChange={(userSession) => {
                    if (userSession) {
                      if (role === "mentor") {
                        router.push("/mentor");
                      } else {
                        router.push("/interview/batch_01_frontend");
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-widest absolute">
                Or Continue With Email
              </span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-slate-300 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === "mentor" ? "mentor@example.com" : "student1@example.com"}
                    className="pl-9 h-10 border-slate-700 bg-slate-950 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-slate-300 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-9 pr-9 h-10 border-slate-700 bg-slate-950 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-500 font-bold text-xs hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/20"
              >
                {loading ? "Signing in..." : `Sign In as ${role === "mentor" ? "Mentor" : "Candidate"} →`}
              </Button>
            </form>

            <div className="text-center pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-indigo-400 font-bold hover:underline">
                  Register New Account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
