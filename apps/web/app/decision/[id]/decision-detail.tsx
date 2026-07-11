"use client";

import Link from "next/link";
import { useState } from "react";
import { useDecisions } from "@/components/decisions/decision-store";
import { DecisionCard, StateBadge } from "@/components/decisions/decision-card";
import { useEvidence } from "@/components/evidence/evidence-drawer";
import { LIFECYCLE_STAGES, STAGE_LABEL, type ActivityKind } from "@/lib/decisions/types";

/**
 * Decision detail — the work-item view (spec Priority 1 + 9). The card with
 * its full action set sits on the left; the right rail carries the lifecycle
 * tracker, workflow tasks, watchers and the collaboration thread (comments
 * with @mentions, approvals, assignments, version history).
 */

const KIND_ICON: Record<ActivityKind, string> = {
  created: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z",
  comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  action: "M5 12h14M13 6l6 6-6 6",
  approval: "M20 6 9 17l-5-5",
  assignment: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
  task: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  version: "M12 3v18M5.5 8.5 12 3l6.5 5.5",
};

/** Render @mentions as highlighted tokens. */
function Mentions({ text }: { text: string }) {
  const parts = text.split(/(@[\w.-]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="rounded bg-brand-light-blue px-1 font-medium text-brand-blue dark:bg-muted">{p}</span>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function DecisionDetail({ id }: { id: string }) {
  const api = useDecisions();
  const openEvidence = useEvidence();
  const [comment, setComment] = useState("");
  const d = api.get(id);

  if (!d) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Decision not found.{" "}
        <Link href="/decision" className="font-semibold text-primary">Back to the Decision Centre</Link>
      </div>
    );
  }

  const stageIdx = LIFECYCLE_STAGES.indexOf(d.stage);
  const doneTasks = d.tasks.filter((t) => t.done).length;

  const postComment = () => {
    const text = comment.trim();
    if (!text) return;
    api.comment(d.id, text);
    setComment("");
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/decision" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-muted">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          Decision Centre
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Decision work item · {d.id}</span>
        <span className="ml-auto"><StateBadge state={d.state} /></span>
      </div>

      {/* Lifecycle tracker — Insight → … → Outcome (spec Priority 10) */}
      <div className="mb-5 overflow-x-auto rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex min-w-[640px] items-center">
          {LIFECYCLE_STAGES.map((s, i) => {
            const reached = i <= stageIdx;
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] font-bold ${
                      reached ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] ${i === stageIdx ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                    {STAGE_LABEL[s]}
                  </span>
                </div>
                {i < LIFECYCLE_STAGES.length - 1 && <span className={`mx-1.5 mb-4 h-0.5 flex-1 rounded ${i < stageIdx ? "bg-primary" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <DecisionCard decision={d} />

          {d.tasks.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Workflow tasks
                <span className="normal-case tracking-normal">{doneTasks}/{d.tasks.length} complete</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {d.tasks.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted/40">
                    <input type="checkbox" checked={t.done} onChange={() => api.toggleTask(d.id, t.id)} className="mt-0.5 accent-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className={`block text-[12.5px] ${t.done ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{t.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{t.owner}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Supporting evidence</p>
            <button onClick={() => openEvidence(d.evidence)} className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:border-primary/50">
              <span>
                <span className="block text-[13px] font-semibold text-card-foreground">{d.evidence.metric}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{d.evidence.objectRef} · {d.evidence.asOf}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold tabular-nums text-foreground">
                {d.evidence.value}
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>
              </span>
            </button>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Watchers</p>
            <div className="flex flex-wrap gap-1.5">
              {d.watchers.map((w) => (
                <span key={w} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11.5px] text-card-foreground">{w}</span>
              ))}
              <button
                onClick={() => api.watch(d.id, "You")}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  d.watchers.includes("You") ? "border-transparent bg-primary text-primary-foreground" : "border-border text-primary hover:bg-muted"
                }`}
              >
                {d.watchers.includes("You") ? "Watching ✓" : "+ Watch"}
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Activity &amp; collaboration · v{d.version}
            </p>
            <div className="relative flex max-h-[440px] flex-col gap-3 overflow-y-auto pl-[26px]">
              <span className="absolute bottom-1 left-2.5 top-1 w-0.5 bg-border" />
              {[...d.activity].reverse().map((a, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[26px] top-0.5 grid h-5 w-5 place-items-center rounded-full border border-border bg-background text-primary">
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2"><path d={KIND_ICON[a.kind]} /></svg>
                  </span>
                  <div className="flex items-baseline gap-2">
                    <b className="text-[12px] font-semibold text-card-foreground">{a.actor}</b>
                    <time className="font-mono text-[9.5px] text-muted-foreground">{a.at.slice(0, 16).replace("T", " ")}</time>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    <Mentions text={a.text} />
                  </p>
                </div>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                postComment();
              }}
            >
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Comment — use @name to mention…"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
              />
              <button type="submit" disabled={!comment.trim()} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-40">
                Post
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
