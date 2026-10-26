import Image from "next/image";
import { BarChart3, CheckCircle2, ShieldCheck, Sparkles, Video } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

const benefits = [
  {
    icon: Video,
    title: "Structured AI interviews",
    description: "Run consistent, timed mock interviews with voice and video guidance.",
  },
  {
    icon: BarChart3,
    title: "Clear performance insights",
    description: "Turn every session into practical scores, feedback, and next steps.",
  },
  {
    icon: ShieldCheck,
    title: "Built for focused practice",
    description: "Private interview links, controlled access, and attentive session tracking.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(99,102,241,0.12),transparent_30%),radial-gradient(circle_at_88%_88%,rgba(168,85,247,0.10),transparent_28%)] dark:bg-[radial-gradient(circle_at_12%_12%,rgba(99,102,241,0.20),transparent_28%),radial-gradient(circle_at_88%_88%,rgba(168,85,247,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="size-10 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Image src="/assets/icon.webp" alt="PlacementKit" width={40} height={40} className="size-full object-cover" priority />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight">PlacementKit</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Interview workspace</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-10 px-5 pb-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-20">
        <section className="hidden lg:block">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            <Sparkles className="size-3.5" /> AI-powered placement preparation
          </div>
          <h1 className="max-w-xl text-5xl font-extrabold leading-[1.08] tracking-[-0.04em] text-foreground">
            Practice with purpose. <span className="text-indigo-600 dark:text-indigo-400">Interview with confidence.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            PlacementKit gives candidates a realistic interview experience and gives mentors a simpler way to create, share, and review every assessment.
          </p>

          <div className="mt-9 grid max-w-xl gap-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm backdrop-blur transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/40">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <benefit.icon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold">{benefit.title}</h2>
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[470px] py-6 lg:py-0">{children}</section>
      </main>
    </div>
  );
}
