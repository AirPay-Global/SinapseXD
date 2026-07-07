export function InsightPanel({ insight }: { insight: string }) {
  return (
    <div className="rounded-xl border border-brand-blue/20 bg-brand-light-blue p-4 dark:bg-muted">
      <div className="mb-2 flex items-center gap-2">
        <svg className="h-4 w-4 text-brand-blue" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zm7 12l.9 2.8 2.9.7-2.9.7-.9 2.8-.9-2.8-2.9-.7 2.9-.7.9-2.8z" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
          Sinapse Intelligence
        </span>
      </div>
      <p className="text-sm text-foreground">{insight}</p>
    </div>
  );
}
