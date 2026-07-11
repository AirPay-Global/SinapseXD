"use client";

import { useState } from "react";

type Role = "user" | "assistant";
interface ChatMessage {
  role: Role;
  content: string;
  status?: "live" | "demo" | "down" | "limited";
}

const SUGGESTIONS = [
  "Summarize Durban's berth pressure right now",
  "Which data pillars are live vs demo today?",
  "What's the corridor performance for Mombasa–Kampala?",
  "What should I look at first as a new DFI analyst?",
];

const STATUS_LABEL: Record<string, string> = { live: "Live · Claude", demo: "Demo", down: "Error", limited: "Rate limited" };
const STATUS_CLASS: Record<string, string> = {
  live: "bg-success/10 text-success",
  demo: "border border-border text-muted-foreground",
  down: "bg-destructive/10 text-destructive",
  limited: "bg-warning/10 text-warning",
};

export function JarvisView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm Jarvis, your Sinapse decision copilot. Ask me about any port, corridor, or which data pillars are live right now — I'll never make up a number the platform doesn't actually have.",
    },
  ]);
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
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "No response.", status: data.status }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach Jarvis — check your connection and try again.", status: "down" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        {messages.map((m, i) => (
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
                  <svg className="h-3.5 w-3.5 text-brand-blue" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zm7 12l.9 2.8 2.9.7-2.9.7-.9 2.8-.9-2.8-2.9-.7 2.9-.7.9-2.8z" />
                  </svg>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-blue">AI Jarvis</span>
                  {m.status && (
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_CLASS[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && <p className="text-xs text-muted-foreground">Jarvis is thinking…</p>}
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
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
          placeholder="Ask Jarvis about a port, corridor, or the platform itself…"
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
  );
}
