/**
 * Loading placeholder. Respects prefers-reduced-motion via the `animate-none`
 * fallback in globals.css (the pulse is disabled there for reduced motion).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden />;
}

/** A block of stacked skeleton lines sized to a chart body. */
export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className="flex flex-col justify-end gap-2" style={{ height }} aria-hidden>
      <Skeleton className="h-full w-full" />
    </div>
  );
}

/** Rows of skeleton lines sized to a table body. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}
