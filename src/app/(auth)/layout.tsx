export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-background text-foreground">
      {/* ── Glowing ambient background spots ──────────────── */}
      <div className="absolute top-[-10%] left-[-10%] h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-[80px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[300px] w-[300px] md:h-[500px] md:w-[500px] rounded-full bg-violet-500/10 dark:bg-violet-500/20 blur-[80px] md:blur-[120px] pointer-events-none" />

      {/* ── Premium Mesh Grid overlay ─────────────────────────── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* ── Page Content Container ─────────────────────────── */}
      <main className="relative z-10 flex w-full items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}