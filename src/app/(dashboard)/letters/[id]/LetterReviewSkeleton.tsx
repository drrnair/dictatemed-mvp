// src/app/(dashboard)/letters/[id]/LetterReviewSkeleton.tsx
// Loading skeleton for letter review page

export function LetterReviewSkeleton() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header skeleton */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-9 w-32 animate-pulse rounded bg-muted" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="h-7 w-48 animate-pulse rounded bg-muted" />
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-9 w-24 animate-pulse rounded bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
            <div className="h-9 w-36 animate-pulse rounded bg-muted" />
          </div>
        </div>

        {/* Progress bar skeleton */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="h-2 max-w-xs flex-1 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        </div>
      </header>

      {/* Main content skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar skeleton */}
        <aside className="w-80 space-y-4 border-r border-border bg-card p-4">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-5 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </aside>

        {/* Main editor skeleton */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="h-6 w-full animate-pulse rounded bg-muted" />
            <div className="h-6 w-full animate-pulse rounded bg-muted" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-20" />
            <div className="h-6 w-full animate-pulse rounded bg-muted" />
            <div className="h-6 w-full animate-pulse rounded bg-muted" />
            <div className="h-6 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-20" />
            <div className="h-6 w-full animate-pulse rounded bg-muted" />
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </main>
      </div>
    </div>
  );
}
