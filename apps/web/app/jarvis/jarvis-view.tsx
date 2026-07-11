"use client";

import { useState } from "react";
import { ADVISORS, DEFAULT_ADVISOR_ID, getAdvisor } from "@/lib/ai/advisors";
import { useRole } from "@/components/role-context";

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
  advisorId?: string;
  status?: "live" | "demo" | "down" | "limited";
}

const STATUS_LABEL: Record<string, string> = { live: "Live · Claude", demo: "Demo", down: "Error", limited: "Rate limited" };
// Tailwind can't alpha var-based colors, so tinted chips use color-mix inline.
const STATUS_TONE: Record<string, { cls: string; bg?: string }> = {
  live: { cls: "text-success", bg: "var(--success)" },
  demo: { cls: "border border-border text-muted-foreground" },
  down: { cls: "text-destructive", bg: "var(--destructive)" },
  limited: { cls: "text-warning", bg: "var(--warning)" },
};

export function JarvisView() {
  const { role } = useRole();
  const [advisorId, setAdvisorId] = useState(DEFAULT_ADVISOR_ID);
  const advisor = getAdvisor(advisorId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="grid items-start gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Advisor bench */}
      <aside className="rounded-xl border border-border bg-card p-2 lg:sticky lg:top-0">
        <p className="px-2 pb-1.5 pt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">AI advisors · 13 specialists</p>
        <div className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
          {ADVISORS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAdvisorId(a.id)}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                a.id === advisorId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={a.icon} />
              </svg>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold">{a.domain}</span>
                <span className={`block truncate text-[10px] ${a.id === advisorId ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{a.tagline}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy text-white">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={advisor.icon} /></svg>
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-foreground">{advisor.name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{advisor.tagline}</p>
          </div>
          <span className="ml-auto hidden shrink-0 text-right font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground sm:block">
            Advising {role.name}<br />{role.org} · {role.country}
          </span>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          {messages.length === 0 && (
            <div className="max-w-[85%] rounded-xl border border-brand-blue/20 bg-brand-light-blue px-4 py-2.5 text-[13.5px] leading-relaxed text-foreground dark:bg-muted">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{advisor.name}</p>
              I&apos;m the {advisor.name.toLowerCase()} — {advisor.tagline.toLowerCase()}. I know you&apos;re signed in as {role.name} ({role.org}) and I ground
              every answer in the platform&apos;s live ontology and pillar status. I&apos;ll never make up a number the platform doesn&apos;t actually have.
            </div>
          )}
          {messages.map((m, i) => {
            const a = m.advisorId ? getAdvisor(m.advisorId) : advisor;
            const tone = m.status ? STATUS_TONE[m.status] : undefined;
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-brand-blue/20 bg-brand-light-blue text-foreground dark:bg-muted"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d={a.icon} />
                      </svg>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">{a.name}</span>
                      {m.status && tone && (
                        <span
                          className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase ${tone.cls}`}
                          style={tone.bg ? { background: `color-mix(in srgb, ${tone.bg} 12%, transparent)` } : undefined}
                        >
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
        </div>

        {messages.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {advisor.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask the ${advisor.name.toLowerCase()}…`}
            className="flex-1 bg-transparent px-2 py-1.5 text-sm text-foreground outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
