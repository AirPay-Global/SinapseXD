"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EvidenceProvider } from "@/components/evidence/evidence-drawer";
import { RoleSwitcher } from "@/components/role-switcher";

/**
 * Decision OS shell (Design Bible §3). Decision-first, dual-navigation:
 * decisions and stakeholder command centres up top, the ontology/intelligence/
 * evidence lenses below. The 4 existing dashboards are reframed here as
 * Stakeholder Command Centres. Everything renders inside the EvidenceProvider
 * so any value on any screen can open the evidence drawer.
 */

type Item = { href?: string; label: string; icon: JSX.Element; soon?: boolean; badge?: string };
type Group = { heading: string; items: Item[] };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: Group[] = [
  {
    heading: "Decide",
    items: [
      { href: "/decision", label: "Decision Centre", icon: I("M3 12h4l3 8 4-16 3 8h4") },
      { href: "/stakeholders", label: "Stakeholders", badge: "14", icon: I("M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75") },
      { label: "AI Copilot", soon: true, icon: I("M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z") },
    ],
  },
  {
    heading: "Stakeholder Command Centres",
    items: [
      { href: "/dashboard/port", label: "Port Authority", icon: I("M3 21h18M5 21V10l7-4 7 4v11M9 21v-5h6v5") },
      { href: "/dashboard/government", label: "Government & Policy", icon: I("M4 21h16M6 21V8l6-4 6 4v13M10 21v-4h4v4") },
      { href: "/dashboard/dfi", label: "DFI Investment", icon: I("M4 20V6M4 20h16M8 20v-6M12 20v-9M16 20v-4M20 20V9") },
      { href: "/dashboard/afcfta", label: "AfCFTA Monitoring", icon: I("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18") },
    ],
  },
  {
    heading: "Explore",
    items: [
      { href: "/ontology", label: "Ontology Explorer", badge: "14", icon: I("M12 7V5M8 15l3-3M16 15l-3-3M12 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M5 16.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M19 16.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3") },
      { label: "Intelligence Centre", soon: true, icon: I("M4 4h16v12H4zM8 14l3-3 2 2 5-5") },
      { href: "/evidence", label: "Evidence Centre", icon: I("M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4") },
      { label: "Digital Twin", soon: true, icon: I("M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10") },
    ],
  },
  {
    heading: "Operate",
    items: [{ label: "Platform Administration", soon: true, icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-1.7-1L15 3H9l-.4 2.1a8 8 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.7 1L9 21h6l.4-2.1a8 8 0 0 0 1.7-1l2.3 1 2-3.4z") }],
  },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium w-full text-left";
  if (item.soon) {
    return (
      <span className={`${base} cursor-default text-muted-foreground opacity-60`}>
        {item.icon}
        {item.label}
        <span className="ml-auto rounded-full border border-border px-1.5 font-mono text-[9.5px] text-muted-foreground">soon</span>
      </span>
    );
  }
  return (
    <Link href={item.href!} className={`${base} transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      {item.icon}
      {item.label}
      {item.badge && (
        <span className={`ml-auto rounded-full px-1.5 font-mono text-[9.5px] ${active ? "bg-white/20" : "border border-border text-muted-foreground"}`}>{item.badge}</span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <EvidenceProvider>
      <div className="grid h-screen grid-cols-1 md:grid-cols-[248px_1fr]">
        {/* Sidebar */}
        <aside className="hidden min-h-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#dbe8fb" strokeWidth="2">
                <circle cx="12" cy="12" r="2.2" fill="var(--brand-orange)" stroke="none" />
                <circle cx="5" cy="6" r="1.4" /><circle cx="19" cy="6" r="1.4" /><circle cx="5" cy="18" r="1.4" /><circle cx="19" cy="18" r="1.4" />
                <path d="M6.4 6.8 10 11M17.6 6.8 14 11M6.4 17.2 10 13M17.6 17.2 14 13" />
              </svg>
            </span>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-foreground">Sinapse</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Decision OS</p>
            </div>
          </div>

          <RoleSwitcher />

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {NAV.map((g) => (
              <div key={g.heading}>
                <p className="px-2.5 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{g.heading}</p>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((it) => (
                    <NavLink key={it.label} item={it} active={!!it.href && pathname.startsWith(it.href)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-border px-5 py-3 text-[10.5px] text-muted-foreground">AirPay Global Inc.</div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-5">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground sm:flex sm:w-[380px]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
              <span className="flex-1 text-[13px]">Ask Sinapse…</span>
              <span className="rounded border border-border px-1.5 font-mono text-[10px]">⌘K</span>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Decision OS</span>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-9">{children}</main>
        </div>
      </div>
    </EvidenceProvider>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-3xl font-bold text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
