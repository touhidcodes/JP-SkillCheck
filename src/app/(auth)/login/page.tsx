'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Mail, Lock, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { USER_ROLES, LoginSchema } from '@/lib/validators/auth.schema';

import type { UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  manager: 'Manager',
  mentor:  'Mentor',
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<UserRole>('mentor'); // Default to mentor for better UX
  const [showPassword, setShowPassword] = useState(false);

  // Field-level error validation states
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const result = LoginSchema.safeParse({ email, password, role });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      toast.error(result.error.issues[0].message);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result.data),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Login failed. Please verify your credentials.');
        return;
      }

      toast.success('Successfully logged in! Redirecting...');
      router.push(role === 'manager' ? '/manager' : '/mentor');
      router.refresh();
    } catch {
      toast.error('An unexpected connection error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] px-4 animate-scale-in">
      <Card className="relative overflow-hidden border-border/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-2xl transition-all duration-300">
        
        {/* Decorative subtle top accent gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <CardHeader className="space-y-6 pb-6 pt-8 text-center">
          {/* Logo Frame */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 transition-transform duration-300 hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white dark:bg-slate-950 overflow-hidden">
              <Image
                src="/assets/icon.webp"
                alt="Placement Dashboard Logo"
                width={52}
                height={52}
                className="object-cover w-full h-full"
                priority
              />
            </div>
          </div>

          {/* Title Text */}
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-50 dark:via-white dark:to-slate-50 bg-clip-text text-transparent">
              Welcome back
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Sign in to your Placement Dashboard account
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pb-8 px-6 md:px-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Role Tab Selector (Segmented Design) */}
            <div className="space-y-2 animate-fade-up stagger-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Workspace Role
              </Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 p-1 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
                {USER_ROLES.map((r) => {
                  const isActive = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={isLoading}
                      onClick={() => setRole(r)}
                      className={`
                        flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200
                        ${isActive 
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/40 dark:ring-slate-800/40' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-700/40'
                        }
                        disabled:opacity-50 disabled:pointer-events-none
                      `}
                    >
                      {r === 'manager' ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : (
                        <Users className="h-3.5 w-3.5" />
                      )}
                      {ROLE_LABELS[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5 animate-fade-up stagger-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Email Address
                </Label>
                {errors.email && (
                  <span className="text-[10px] font-semibold text-rose-500 animate-fade-in">
                    {errors.email}
                  </span>
                )}
              </div>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`pl-9 h-11 bg-slate-50/50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 ${errors.email ? 'border-rose-500 dark:border-rose-500/80 focus:ring-rose-500/10 focus:border-rose-500' : ''}`}
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5 animate-fade-up stagger-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Password
                </Label>
                {errors.password && (
                  <span className="text-[10px] font-semibold text-rose-500 animate-fade-in">
                    {errors.password}
                  </span>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`pl-9 pr-10 h-11 bg-slate-50/50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all duration-200 ${errors.password ? 'border-rose-500 dark:border-rose-500/80 focus:ring-rose-500/10 focus:border-rose-500' : ''}`}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/10 active:scale-[0.99] transition-all duration-200 mt-3 animate-fade-up stagger-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Signing in to account…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <Separator className="my-6 animate-fade-up stagger-5" />

          <p className="text-center text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-normal animate-fade-up stagger-6">
            Contact your dashboard administrator if you require account access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
