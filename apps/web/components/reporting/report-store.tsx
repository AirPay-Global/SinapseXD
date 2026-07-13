"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { instantiateReport, type CreateInput } from "@/lib/reporting/instantiate";
import { SEED_REPORTS, SEED_VERSION } from "@/lib/reporting/seed";
import type { AiLogEntry, Report, ReportActivity, ReportStatus } from "@/lib/reporting/model";

/**
 * Reporting Centre store (spec §7 lifecycle, §17 collaboration, §18 audit).
 * Seed reports render identically on server and client; user actions overlay
 * as full report snapshots persisted to localStorage. Approving a report seals
 * an immutable version + evidence snapshot; editing an approved report opens a
 * new working version, preserving the sealed one (§18).
 */

const STORAGE_KEY = "sinapse.reports";

interface ReportApi {
  reports: Report[];
  get(id: string): Report | undefined;
  create(input: CreateInput): string;
  updateSection(id: string, sectionId: string, content: string): void;
  setAssignment(id: string, field: "reviewer" | "approver", value: string): void;
  addComment(id: string, text: string): void;
  appendAiDraft(id: string, sectionId: string, text: string, advisor: string, status: AiLogEntry["status"], prompt: string): void;
  submitReview(id: string): void;
  startReview(id: string): void;
  returnForChanges(id: string, reason: string): void;
  submitApproval(id: string): void;
  approve(id: string, comment?: string): void;
  reject(id: string, reason: string): void;
  publish(id: string): void;
  archive(id: string): void;
  reset(): void;
}

const Ctx = createContext<ReportApi | null>(null);
export function useReports(): ReportApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useReports must be used inside <ReportProvider>");
  return c;
}

type Store = Record<string, Report>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { version: string; reports: Store };
    return parsed.version === SEED_VERSION ? parsed.reports : {};
  } catch {
    return {};
  }
}

function entry(kind: ReportActivity["kind"], text: string, actor = "You"): ReportActivity {
  return { at: new Date().toISOString(), actor, kind, text };
}

function snapId(): string {
  return "snap-" + Math.random().toString(16).slice(2, 8);
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>({});

  useEffect(() => setStore(load()), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, reports: store }));
    } catch {
      /* private mode */
    }
  }, [store]);

  const api = useMemo<ReportApi>(() => {
    const reports: Report[] = [
      ...SEED_REPORTS.map((s) => store[s.id] ?? s),
      ...Object.values(store).filter((r) => !SEED_REPORTS.some((s) => s.id === r.id)),
    ];
    const byId = new Map(reports.map((r) => [r.id, r]));

    const write = (r: Report) => setStore((prev) => ({ ...prev, [r.id]: { ...r, updatedAt: new Date().toISOString() } }));
    const patch = (id: string, fn: (r: Report) => Report) => {
      const r = byId.get(id);
      if (r) write(fn(r));
    };
    const setStatus = (id: string, status: ReportStatus, act: ReportActivity) =>
      patch(id, (r) => ({ ...r, status, activity: [...r.activity, act] }));

    // Editing a sealed (approved/published) report opens a new working version.
    const unseal = (r: Report): Report =>
      r.locked
        ? { ...r, locked: false, status: "draft", activity: [...r.activity, entry("version", `Opened a new working version (v${r.currentVersion + 1} in progress).`)] }
        : r;

    return {
      reports,
      get: (id) => byId.get(id),
      create: (input) => {
        const id = `rep-${input.entityId}-${input.templateId}-${Math.random().toString(16).slice(2, 6)}`;
        write(instantiateReport(input, id, new Date().toISOString()));
        return id;
      },
      updateSection: (id, sectionId, content) =>
        patch(id, (r0) => {
          const r = unseal(r0);
          return {
            ...r,
            sections: r.sections.map((s) =>
              s.id === sectionId
                ? { ...s, content, aiDrafted: false, complete: s.type === "kpi" || s.type === "chart" ? s.metricRefs.length > 0 : s.type === "cover" ? true : content.trim().length > 20 }
                : s,
            ),
          };
        }),
      setAssignment: (id, field, value) =>
        patch(id, (r) => ({ ...r, [field]: value, activity: [...r.activity, entry("status", `${field === "reviewer" ? "Reviewer" : "Approver"} set to ${value}.`)] })),
      addComment: (id, text) => patch(id, (r) => ({ ...r, activity: [...r.activity, entry("comment", text)] })),
      appendAiDraft: (id, sectionId, text, advisor, status, prompt) =>
        patch(id, (r) => {
          const log: AiLogEntry = { at: new Date().toISOString(), advisor, prompt, status, outputChars: text.length };
          return {
            ...r,
            sections: r.sections.map((s) => (s.id === sectionId ? { ...s, content: text, aiDrafted: true, complete: text.trim().length > 20 } : s)),
            aiLog: [...r.aiLog, log],
            activity: [...r.activity, entry("ai", `${advisor} drafted “${r.sections.find((s) => s.id === sectionId)?.title}” — pending human review.`)],
          };
        }),
      submitReview: (id) => setStatus(id, "ready_for_review", entry("status", "Marked ready for review.")),
      startReview: (id) => setStatus(id, "in_review", entry("status", "Review started.")),
      returnForChanges: (id, reason) =>
        patch(id, (r) => ({ ...r, status: "returned", approvals: [...r.approvals, { version: r.currentVersion, actor: "You", action: "return", comment: reason, at: new Date().toISOString() }], activity: [...r.activity, entry("status", `Returned for changes — ${reason}`)] })),
      submitApproval: (id) =>
        patch(id, (r) => ({ ...r, status: "submitted_approval", approvals: [...r.approvals, { version: r.currentVersion, actor: "You", action: "submit_approval", at: new Date().toISOString() }], activity: [...r.activity, entry("status", "Submitted for approval — content locked pending decision.")] })),
      approve: (id, comment) =>
        patch(id, (r) => {
          const version = r.currentVersion + 1;
          const snapshot = snapId();
          return {
            ...r,
            status: "approved",
            locked: true,
            currentVersion: version,
            versions: [...r.versions, { number: version, at: new Date().toISOString(), by: r.author, changeSummary: comment || "Approved version.", evidenceSnapshotId: snapshot, validationStatus: "passed" }],
            approvals: [...r.approvals, { version, actor: "You", action: "approve", comment, at: new Date().toISOString() }],
            activity: [...r.activity, entry("status", `Approved — version ${version} sealed with evidence snapshot ${snapshot}.`)],
          };
        }),
      reject: (id, reason) =>
        patch(id, (r) => ({ ...r, status: "returned", approvals: [...r.approvals, { version: r.currentVersion, actor: "You", action: "reject", comment: reason, at: new Date().toISOString() }], activity: [...r.activity, entry("status", `Rejected — ${reason}`)] })),
      publish: (id) => setStatus(id, "published", entry("distribution", "Published to the intended audience.")),
      archive: (id) => setStatus(id, "archived", entry("status", "Archived for audit and historical reference.")),
      reset: () => setStore({}),
    };
  }, [store]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
