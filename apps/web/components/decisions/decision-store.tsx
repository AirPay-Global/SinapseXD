"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SEED_DECISIONS, SEED_VERSION } from "@/lib/decisions/seed";
import type {
  DecisionActivity,
  DecisionItem,
  DecisionOverlay,
  DecisionStage,
  DecisionState,
  WorkflowTask,
} from "@/lib/decisions/types";

/**
 * Decision store (spec Priority 1 + 9 + 10). Seed decisions are static and
 * render identically on server and client; user actions (accept, delegate,
 * comments, …) are kept as a per-decision overlay merged over the seed and
 * persisted to localStorage, so the seed can evolve without stranding state.
 */

const STORAGE_KEY = "sinapse.decisions.overlay";

type Overlays = Record<string, DecisionOverlay>;

interface DecisionApi {
  decisions: DecisionItem[];
  get(id: string): DecisionItem | undefined;
  accept(id: string): void;
  reject(id: string, reason?: string): void;
  modify(id: string, recommendation: string): void;
  delegate(id: string, owner: string): void;
  schedule(id: string, date: string): void;
  launchWorkflow(id: string): void;
  openInvestigation(id: string): void;
  comment(id: string, text: string): void;
  toggleTask(id: string, taskId: string): void;
  watch(id: string, name: string): void;
  /** Create a brand-new decision (e.g. from a visualisation); returns its id. */
  createDecision(item: DecisionItem): string;
  reset(): void;
}

const DecisionContext = createContext<DecisionApi | null>(null);

export function useDecisions(): DecisionApi {
  const ctx = useContext(DecisionContext);
  if (!ctx) throw new Error("useDecisions must be used inside <DecisionProvider>");
  return ctx;
}

function loadPersisted(): { overlays: Overlays; created: DecisionItem[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { overlays: {}, created: [] };
    const parsed = JSON.parse(raw) as { version: string; overlays: Overlays; created?: DecisionItem[] };
    return parsed.version === SEED_VERSION ? { overlays: parsed.overlays, created: parsed.created ?? [] } : { overlays: {}, created: [] };
  } catch {
    return { overlays: {}, created: [] };
  }
}

function merge(seed: DecisionItem, o?: DecisionOverlay): DecisionItem {
  if (!o) return seed;
  return {
    ...seed,
    state: o.state ?? seed.state,
    stage: o.stage ?? seed.stage,
    owner: o.owner ?? seed.owner,
    dueDate: o.dueDate ?? seed.dueDate,
    recommendation: o.recommendation ?? seed.recommendation,
    watchers: o.watchers ?? seed.watchers,
    tasks: o.tasks ?? seed.tasks,
    version: o.version ?? seed.version,
    activity: [...seed.activity, ...(o.activity ?? [])],
  };
}

function entry(kind: DecisionActivity["kind"], text: string, actor = "You"): DecisionActivity {
  return { at: new Date().toISOString(), actor, kind, text };
}

/** Default follow-up tasks created when a workflow is launched from a decision. */
function workflowTasks(d: DecisionItem): WorkflowTask[] {
  return [
    { id: "w1", title: `Confirm execution plan: ${d.recommendation.slice(0, 60)}…`, owner: d.owner, done: false },
    { id: "w2", title: "Notify watchers and affected stakeholders", owner: "Sinapse · automated", done: false },
    { id: "w3", title: "Set outcome baseline for monitoring", owner: "Sinapse · automated", done: false },
  ];
}

export function DecisionProvider({ children }: { children: ReactNode }) {
  const [overlays, setOverlays] = useState<Overlays>({});
  const [created, setCreated] = useState<DecisionItem[]>([]);

  // Hydrate after mount so SSR output (pure seed) matches the first client render.
  useEffect(() => {
    const p = loadPersisted();
    setOverlays(p.overlays);
    setCreated(p.created);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, overlays, created }));
    } catch {
      /* storage unavailable (private mode) — actions still work in-memory */
    }
  }, [overlays, created]);

  const api = useMemo<DecisionApi>(() => {
    // Created decisions (e.g. from a visualisation) sit alongside the seed and
    // take overlays just like seed items do.
    const bases = [...created, ...SEED_DECISIONS];
    const decisions = bases.map((d) => merge(d, overlays[d.id]));
    const byId = new Map(decisions.map((d) => [d.id, d]));

    const patch = (id: string, fn: (current: DecisionItem, o: DecisionOverlay) => DecisionOverlay) =>
      setOverlays((prev) => {
        const seed = bases.find((d) => d.id === id);
        if (!seed) return prev;
        const current = merge(seed, prev[id]);
        return { ...prev, [id]: fn(current, prev[id] ?? {}) };
      });

    const setState = (id: string, state: DecisionState, stage: DecisionStage, kind: DecisionActivity["kind"], text: string) =>
      patch(id, (_c, o) => ({ ...o, state, stage, activity: [...(o.activity ?? []), entry(kind, text)] }));

    return {
      decisions,
      get: (id) => byId.get(id),
      accept: (id) => setState(id, "accepted", "approval", "approval", "Accepted the recommendation."),
      reject: (id, reason) =>
        setState(id, "rejected", "outcome", "action", reason ? `Rejected the recommendation — ${reason}` : "Rejected the recommendation."),
      modify: (id, recommendation) =>
        patch(id, (c, o) => ({
          ...o,
          state: "modified",
          recommendation,
          version: c.version + 1,
          activity: [...(o.activity ?? []), entry("version", `Modified the recommendation (v${c.version + 1}): ${recommendation}`)],
        })),
      delegate: (id, owner) =>
        patch(id, (_c, o) => ({
          ...o,
          state: "delegated",
          owner,
          activity: [...(o.activity ?? []), entry("assignment", `Delegated to ${owner}.`)],
        })),
      schedule: (id, date) =>
        patch(id, (_c, o) => ({
          ...o,
          state: "scheduled",
          dueDate: date,
          activity: [...(o.activity ?? []), entry("action", `Scheduled for ${date}.`)],
        })),
      launchWorkflow: (id) =>
        patch(id, (c, o) => ({
          ...o,
          state: c.state === "open" ? "accepted" : c.state,
          stage: "workflow",
          tasks: c.tasks.length ? c.tasks : workflowTasks(c),
          activity: [...(o.activity ?? []), entry("task", "Workflow launched — execution tasks created.")],
        })),
      openInvestigation: (id) =>
        setState(id, "investigating", "insight", "action", "Opened an investigation — routed to the Evidence Advisor."),
      comment: (id, text) => patch(id, (_c, o) => ({ ...o, activity: [...(o.activity ?? []), entry("comment", text)] })),
      toggleTask: (id, taskId) =>
        patch(id, (c, o) => {
          const tasks = c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
          const allDone = tasks.length > 0 && tasks.every((t) => t.done);
          return {
            ...o,
            tasks,
            stage: allDone ? "monitoring" : c.stage === "workflow" ? "execution" : c.stage,
            activity: allDone ? [...(o.activity ?? []), entry("action", "All tasks complete — decision moved to monitoring.")] : o.activity,
          };
        }),
      watch: (id, name) =>
        patch(id, (c, o) => ({
          ...o,
          watchers: c.watchers.includes(name) ? c.watchers.filter((w) => w !== name) : [...c.watchers, name],
        })),
      createDecision: (item) => {
        setCreated((prev) => (prev.some((d) => d.id === item.id) ? prev : [item, ...prev]));
        return item.id;
      },
      reset: () => {
        setOverlays({});
        setCreated([]);
      },
    };
  }, [overlays, created]);

  return <DecisionContext.Provider value={api}>{children}</DecisionContext.Provider>;
}
