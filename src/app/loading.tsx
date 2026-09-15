export default function Loading() {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border/60 p-6 hidden md:block">
        <div className="h-8 w-40 bg-muted rounded animate-pulse mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </aside>
      <div className="flex-1 p-6 bg-background text-foreground">
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-card border border-border/40 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-card border border-border/40 rounded-xl animate-pulse" />
            <div className="h-96 bg-card border border-border/40 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}