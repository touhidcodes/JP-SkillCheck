"use client";

import { useState } from "react";
import { LogIn, LogOut, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs shadow-sm">
        <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-indigo-500/30 bg-indigo-500/10 font-bold text-indigo-700 dark:text-indigo-300">
          {session.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.image} alt={session.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold leading-tight text-foreground">{session.name}</span>
          <span className="flex items-center gap-0.5 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-2.5 h-2.5" /> {session.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="ml-1 h-6 w-6 p-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
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
        className="h-8 border-border bg-card text-xs font-medium text-foreground shadow-sm hover:border-indigo-500 hover:bg-accent"
      >
        <LogIn className="mr-1.5 h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Sign in with Google
      </Button>
    </div>
  );
}
