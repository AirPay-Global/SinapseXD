"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ADVISORS, DEFAULT_ADVISOR_ID, getAdvisor } from "@/lib/ai/advisors";
import { useRole } from "@/components/role-context";

/**
 * Global AI Advisor panel (XDi modernisation §11). Opens as a right-side
 * drawer from anywhere via useAdvisorPanel(), so a specialist is always one
 * click away; the dedicated full-page workspace at /jarvis stays for deeper
 * analysis. The drawer shows the current lens, the stakeholder context it's
 * grounded in, and the live/demo data posture — then answers through the same
 * /api/jarvis route, never inventing a number the platform doesn't hold.
 */

type OpenFn = (advisorId?: string) => void;
const AdvisorContext = createContext<OpenFn>(() => {});
export const useAdvisorPanel = () => useContext(AdvisorContext);

interface Msg {
  role: "user" | "assistant";
  content: string;
  advisorId?: string;
  status?: "live" | "demo" | "down" | "limited";
}

const STATUS_LABEL: Record<string, string> = { live: "Live · Claude", demo: "Demo", down: "Error", limited: "Rate limited" };
const STATUS_TONE: Record<string, { cls: string; bg?: string }> = {
  live: { cls: "text-success", bg: "var(--success)" },
  demo: { cls: "border border-border text-muted-foreground" },
  down: { cls: "text-destructive", bg: "var(--destructive)" },
  limited: { cls: "text-warning", bg: "var(--warning)" },
};

export function AdvisorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [advisorId, setAdvisorId] = useState(DEFAULT_ADVISOR_ID);
  const openPanel: OpenFn = (id) => {
    if (id) setAdvisorId(id);
    setOpen(true);
  };
  return (
    <AdvisorContext.Provider value={openPanel}>
      {children}
      <Drawer open={open} onClose={() => setOpen(false)} advisorId={advisorId} setAdvisorId={setAdvisorId} />
    </AdvisorContext.Provider>
  );
}

function Drawer({
  open,
  onClose,
  advisorId,
  setAdvisorId,
}: {
  open: boolean;
  onClose: () => void;
  advisorId: string;
  setAdvisorId: (id: string) => void;
}) {
  const { role } = useRole();
  const advisor = getAdvisor(advisorId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          advisor: advisorId,
          context: { stakeholder: role.stakeholder, name: role.name, org: role.org, country: role.country, port: role.port, objectives: role.objectives },
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "No response.", status: data.status, advisorId }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the advisor — check your connection and try again.", status: "down", advisorId }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-[rgba(4,10,20,0.5)] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-hidden={!open}
        aria-label="AI Advisor"
        className={`fixed right-0 top-0 z-[56] flex h-screen w-[min(480px,94vw)] flex-col border-l border-border bg-background shadow-[var(--shadow-lg)] transition-transform duration-[240ms] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header — lens + grounding context */}
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={advisor.icon} /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold leading-tight text-foreground">AI Advisor</p>
              <p className="truncate text-[11px] text-muted-foreground">Ask questions. Investigate evidence. Make better decisions.</p>
            </div>
            <button onClick={onClose} aria-label="Close AI Advisor" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <label className="sr-only" htmlFor="advisor-lens">Specialist lens</label>
            <select
              id="advisor-lens"
              value={advisorId}
              onChange={(e) => setAdvisorId(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-foreground outline-none focus:border-primary"
            >
              {ADVISORS.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {role.name} · {role.country}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.06em]">
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-success" style={{ background: "color-mix(in srgb,var(--success) 12%,transparent)" }}>● Live PortWatch</span>
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-warning" style={{ background: "color-mix(in srgb,var(--warning) 12%,transparent)" }}>● Demo pillars</span>
          </div>
        </header>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-brand-blue/20 bg-brand-light-blue px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground dark:bg-muted">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{advisor.name}</p>
              I&apos;m the {advisor.name.toLowerCase()} — {advisor.tagline.toLowerCase()}. I know you&apos;re signed in as {role.name} and I ground every
              answer in the platform&apos;s live data, honest about what isn&apos;t live yet.
            </div>
          )}
          {messages.map((m, i) => {
            const a = m.advisorId ? getAdvisor(m.advisorId) : advisor;
            const tone = m.status ? STATUS_TONE[m.status] : undefined;
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "border border-brand-blue/20 bg-brand-light-blue text-foreground dark:bg-muted"}`}>
                  {m.role === "assistant" && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={a.icon} /></svg>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{a.name}</span>
                      {m.status && tone && (
                        <span className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone.cls}`} style={tone.bg ? { background: `color-mix(in srgb, ${tone.bg} 12%, transparent)` } : undefined}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            );
          })}
          {loading && <p className="text-xs text-muted-foreground">{advisor.name} is thinking…</p>}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {advisor.suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input + link to full workspace */}
        <div className="border-t border-border p-3">
          <form
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask the ${advisor.name.toLowerCase()}…`}
              className="flex-1 bg-transparent px-2 py-1 text-[13px] text-foreground outline-none"
            />
            <button type="submit" disabled={loading || !input.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground disabled:opacity-40">
              Send
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between px-1">
            <Link href="/jarvis" onClick={onClose} className="font-mono text-[10.5px] text-primary hover:underline">Open full workspace →</Link>
            <span className="font-mono text-[10px] text-muted-foreground">Esc to close</span>
          </div>
        </div>
      </aside>
    </>
  );
}
