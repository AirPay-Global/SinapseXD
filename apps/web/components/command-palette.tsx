"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSearchIndex, type SearchEntry } from "@/lib/search-index";

/**
 * Universal Object Search (⌘K). One palette over every ontology object,
 * decision, advisor and screen — the "everything is an object, everything is
 * findable" contract from the UI Evolution spec's navigation section.
 */

const GROUP_ORDER: SearchEntry["group"][] = ["Objects", "Decisions", "Screens", "AI Advisors", "Object types"];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(buildSearchIndex, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hits = q
      ? index.filter((e) => `${e.label} ${e.sub} ${e.keywords ?? ""}`.toLowerCase().includes(q))
      : index.filter((e) => e.group === "Screens" || e.group === "Decisions");
    return [...hits]
      .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
      .slice(0, 12);
  }, [index, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after the dialog paints.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  const go = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  };

  if (!open) return null;

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal aria-label="Universal object search">
      <div className="absolute inset-0 bg-[rgba(4,10,20,0.55)]" onClick={onClose} />
      <div className="absolute left-1/2 top-[12vh] w-[min(620px,94vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); go(results[cursor]); }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search ports, corridors, countries, decisions, advisors, screens…"
            className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No objects match “{query}”.</p>
          )}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={r.href + r.label}>
                {header && (
                  <p className="px-2.5 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{header}</p>
                )}
                <button
                  onClick={() => go(r)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                    i === cursor ? "bg-primary text-primary-foreground" : "text-card-foreground"
                  }`}
                >
                  <span className="text-[13px] font-semibold">{r.label}</span>
                  <span className={`min-w-0 flex-1 truncate text-[11px] ${i === cursor ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                    {r.sub}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
