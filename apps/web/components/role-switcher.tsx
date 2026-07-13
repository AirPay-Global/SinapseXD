"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, useRole } from "@/components/role-context";

export function RoleSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { role, roleIndex, setRoleIndex } = useRole();

  function pick(i: number) {
    setRoleIndex(i);
    setOpen(false);
    router.push(ROLES[i].href);
  }

  // Collapsed rail — avatar only, tooltip carries the name (spec §7).
  if (collapsed) {
    return (
      <div className="flex justify-center border-b border-border px-2 py-3">
        <span
          title={`${role.name} · ${role.org}`}
          className="grid h-9 w-9 place-items-center rounded-md bg-brand-navy text-[11px] font-bold text-white"
        >
          {role.code}
        </span>
      </div>
    );
  }

  return (
    <div className="relative border-b border-border px-3 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Switch role — currently ${role.name}, ${role.org}`}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-navy text-[11px] font-bold text-white">
          {role.code}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[12.5px] font-semibold text-foreground">{role.name}</span>
          <span className="block truncate text-[10.5px] text-muted-foreground">{role.org}</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-full z-20 mt-1 rounded-lg border border-border bg-card py-1 shadow-lg">
          {ROLES.map((r, i) => (
            <button
              key={r.code}
              onClick={() => pick(i)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] hover:bg-muted ${i === roleIndex ? "text-foreground font-semibold" : "text-muted-foreground"}`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-brand-navy text-[9.5px] font-bold text-white">{r.code}</span>
              <span className="min-w-0 flex-1 truncate">{r.name} <span className="text-muted-foreground">· {r.org}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ROLES };
