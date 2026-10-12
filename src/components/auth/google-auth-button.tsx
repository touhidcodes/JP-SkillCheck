"use client";

import { useState } from "react";
import { LogIn, LogOut, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface UserSession {
  email: string;
  name: string;
  image?: string;
  role?: "student" | "mentor";
}

export function GoogleAuthButton({
  onAuthChange,
}: {
  onAuthChange?: (session: UserSession | null) => void;
}) {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("skillcheck_user_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleDemoSignIn = (email: string, name: string) => {
    const userSession: UserSession = {
      email,
      name,
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      role: email.includes("mentor") ? "mentor" : "student",
    };
    setSession(userSession);
    if (typeof window !== "undefined") {
      localStorage.setItem("skillcheck_user_session", JSON.stringify(userSession));
    }
    if (onAuthChange) onAuthChange(userSession);
  };

  const handleSignOut = () => {
    setSession(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("skillcheck_user_session");
    }
    if (onAuthChange) onAuthChange(null);
  };

  if (session) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
        <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold overflow-hidden border border-indigo-500/30">
          {session.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.image} alt={session.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-slate-200 text-[11px] leading-tight">{session.name}</span>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> {session.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 ml-1"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        onClick={() => handleDemoSignIn("student1@example.com", "Student One (Google)")}
        variant="outline"
        size="sm"
        className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500 font-medium"
      >
        <LogIn className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> Sign in with Google
      </Button>
    </div>
  );
}
