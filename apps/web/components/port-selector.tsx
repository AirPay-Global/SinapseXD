"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export interface PortOption {
  id: string;
  name: string;
  country: string;
}

/**
 * Dynamic port picker for port-scoped dashboards. Options come from the
 * ontology port registry (passed by the server component), so newly seeded
 * ports appear automatically — nothing here is hardcoded. Selection is a
 * `?port=` query param, so views stay server-rendered, links are shareable,
 * and the browser back button walks port history.
 */
export function PortSelector({ ports, selectedId }: { ports: PortOption[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const selected = ports.find((p) => p.id === selectedId) ?? ports[0];

  function pick(id: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("port", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V10l7-4 7 4v11M9 21v-5h6v5" />
        </svg>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold text-foreground">{selected?.name ?? "Select port"}</span>
          <span className="block text-[10.5px] text-muted-foreground">{selected?.country}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-lg">
          {ports.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] hover:bg-muted ${p.id === selected?.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span>{p.name}</span>
              <span className="ml-3 text-[10.5px] text-muted-foreground">{p.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
