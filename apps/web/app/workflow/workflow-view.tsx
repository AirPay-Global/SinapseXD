"use client";

import Link from "next/link";
import { StateBadge } from "@/components/decisions/decision-card";
import { useDecisions } from "@/components/decisions/decision-store";
import { LIFECYCLE_STAGES, STAGE_LABEL, type DecisionItem } from "@/lib/decisions/types";

/**
 * Workflow Centre (UI Evolution spec, Priority 10): the decision lifecycle as
 * a board. Every decision work item sits in exactly one stage of
 * Insight → Recommendation → Approval → Workflow → Tasks → Execution →
 * Monitoring → Outcome; actions taken anywhere in the platform move cards
 * here in real time (same store as the Decision Centre).
 */

function BoardCard({ d }: { d: DecisionItem }) {
  const doneTasks = d.tasks.filter((t) => t.done).length;
  return (
    <Link
      href={`/decision/${d.id}`}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/60"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.sev === "hi" ? "bg-destructive" : d.sev === "md" ? "bg-accent" : "bg-success"}`}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{d.stakeholder}</span>
      </div>
      <p className="text-[12.5px] font-semibold leading-snug text-card-foreground">{d.problem}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] text-muted-foreground">{d.owner.split("·")[0].trim()} · due {d.dueDate}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <StateBadge state={d.state} />
        {d.tasks.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{doneTasks}/{d.tasks.length} tasks</span>
        )}
      </div>
    </Link>
  );
}

export function WorkflowView() {
  const { decisions } = useDecisions();

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {LIFECYCLE_STAGES.map((s, i) => {
          const n = decisions.filter((d) => d.stage === s).length;
          return (
            <span key={s} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground">
              <b className="text-foreground">{i + 1}</b> {STAGE_LABEL[s]}
              <b className={`tabular-nums ${n > 0 ? "text-primary" : ""}`}>{n}</b>
            </span>
          );
        })}
      </div>

      <div className="overflow-x-auto pb-2">
        {/* 8 × ~136px fits a 1440px desktop with the sidebar; narrower screens scroll. */}
        <div className="grid min-w-[1100px] grid-cols-8 gap-2.5">
          {LIFECYCLE_STAGES.map((s) => {
            const items = decisions.filter((d) => d.stage === s);
            return (
              <div key={s} className="flex min-h-[300px] flex-col gap-2 rounded-xl border border-border bg-background/60 p-2">
                <p className="px-1 pt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  {STAGE_LABEL[s]} · {items.length}
                </p>
                {items.map((d) => (
                  <BoardCard key={d.id} d={d} />
                ))}
                {items.length === 0 && (
                  <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-border">
                    <span className="font-mono text-[10px] text-muted-foreground">empty</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-[12px] text-muted-foreground">
        Cards move as you act: <b className="text-foreground">Accept</b> advances a decision to Approval,{" "}
        <b className="text-foreground">Launch Workflow</b> creates its execution tasks, completing every task moves it to
        Monitoring, and measured outcomes close the loop. Board state is yours alone (kept in this browser) until the
        collaboration backend lands.
      </p>
    </>
  );
}
