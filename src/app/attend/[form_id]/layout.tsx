export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
      {children}
    </div>
  );
}
