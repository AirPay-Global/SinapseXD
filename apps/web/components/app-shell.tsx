"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdvisorProvider, useAdvisorPanel } from "@/components/advisor/advisor-drawer";
import { CommandPalette } from "@/components/command-palette";
import { ContextBar } from "@/components/context-bar";
import { DecisionProvider } from "@/components/decisions/decision-store";
import { EvidenceProvider } from "@/components/evidence/evidence-drawer";
import { RoleProvider } from "@/components/role-context";
import { RoleSwitcher } from "@/components/role-switcher";

/**
 * Sinapse XDi command-centre shell (modernisation §7, §8, §19). A collapsible
 * icon-rail sidebar with grouped navigation and soft active pills; a top bar
 * carrying universal search, the always-available AI Advisor, and the theme
 * switch; and a persistent context bar stating the current scope. Everything
 * renders inside the Evidence, Decision, Role and Advisor providers so any
 * value can open its evidence and a specialist is one click away.
 */

type Item = { href?: string; label: string; icon: JSX.Element; soon?: boolean; badge?: string };
type Group = { heading: string; items: Item[] };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const NAV: Group[] = [
  {
    heading: "Decide",
    items: [
      { href: "/decision", label: "Decision Centre", icon: I("M3 12h4l3 8 4-16 3 8h4") },
      { href: "/workflow", label: "Workflow Centre", icon: I("M4 6h6v6H4zM14 12h6v6h-6zM10 9h7M17 9v3") },
      { href: "/simulation", label: "Simulation Centre", icon: I("M4 4h16v12H4zM8 14l3-3 2 2 5-5M8 20h8") },
      { href: "/jarvis", label: "AI Advisor", icon: I("M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z") },
      { href: "/stakeholders", label: "Stakeholders", icon: I("M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75") },
    ],
  },
  {
    heading: "Command Centres",
    items: [
      { href: "/dashboard/port", label: "Port Authority", icon: I("M3 21h18M5 21V10l7-4 7 4v11M9 21v-5h6v5") },
      { href: "/dashboard/government", label: "Government & Policy", icon: I("M4 21h16M6 21V8l6-4 6 4v13M10 21v-4h4v4") },
      { href: "/dashboard/dfi", label: "DFI Investment", icon: I("M4 20V6M4 20h16M8 20v-6M12 20v-9M16 20v-4M20 20V9") },
      { href: "/dashboard/afcfta", label: "AfCFTA Monitoring", icon: I("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18") },
      { label: "Afreximbank", soon: true, icon: I("M3 10h18M5 10V7l7-4 7 4v3M4 21h16M7 21v-8M12 21v-8M17 21v-8") },
      { label: "APRM", soon: true, icon: I("M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z") },
      { label: "African Union", soon: true, icon: I("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8l1.2 2.6L16 11l-2.2 1.6.6 2.8L12 14l-2.4 1.4.6-2.8L8 11l2.8-.4z") },
    ],
  },
  {
    heading: "Explore",
    items: [
      { href: "/ontology", label: "Ontology Explorer", icon: I("M12 7V5M8 15l3-3M16 15l-3-3M12 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M5 16.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M19 16.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3") },
      { href: "/intelligence", label: "Intelligence Centre", icon: I("M4 4h16v12H4zM8 14l3-3 2 2 5-5") },
      { href: "/evidence", label: "Evidence Centre", icon: I("M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4") },
      { href: "/reports/aprm", label: "Reporting Centre", icon: I("M6 3h9l3 3v15H6zM15 3v3h3M8 12h8M8 16h8M8 8h4") },
      { href: "/twin", label: "Digital Twin", badge: "Beta", icon: I("M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10") },
    ],
  },
  {
    heading: "Operate",
    items: [{ label: "Platform Administration", soon: true, icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-1.7-1L15 3H9l-.4 2.1a8 8 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.7 1L9 21h6l.4-2.1a8 8 0 0 0 1.7-1l2.3 1 2-3.4z") }],
  },
];

const BOTTOM: Item[] = [
  { label: "Support", soon: true, icon: I("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01") },
  { label: "Settings", soon: true, icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-1.7-1L15 3H9l-.4 2.1a8 8 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 1.7 1L9 21h6l.4-2.1a8 8 0 0 0 1.7-1l2.3 1 2-3.4z") },
];

function NavLink({ item, active, collapsed }: { item: Item; active: boolean; collapsed: boolean }) {
  const base = `group relative flex items-center rounded-lg text-[13px] font-medium w-full text-left transition-colors ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-2.5 py-[7px]"}`;

  if (item.soon) {
    return (
      <span title={collapsed ? `${item.label} — soon` : undefined} className={`${base} cursor-default text-muted-foreground/70`}>
        {item.icon}
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">soon</span>
          </>
        )}
      </span>
    );
  }
  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`${base} ${active ? "bg-surface-active font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" aria-hidden />}
      {item.icon}
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"}`}>{item.badge}</span>
          )}
        </>
      )}
    </Link>
  );
}

function NavGroup({ group, pathname, collapsed }: { group: Group; pathname: string; collapsed: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      {!collapsed && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 px-2.5 pb-1 pt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
        >
          {group.heading}
          <svg viewBox="0 0 24 24" className={`ml-auto h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
      {collapsed && <div className="my-2 h-px bg-border" aria-hidden />}
      {(open || collapsed) && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((it) => (
            <NavLink key={it.label} item={it} active={!!it.href && pathname.startsWith(it.href)} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("sinapse.theme");
    const initial = saved === "dark" || saved === "light" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", initial);
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sinapse.theme", next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}

function AdvisorButton() {
  const openAdvisor = useAdvisorPanel();
  return (
    <button
      onClick={() => openAdvisor()}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9z" /></svg>
      <span className="hidden sm:inline">AI Advisor</span>
    </button>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sinapse.nav") === "collapsed");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sinapse.nav", next ? "collapsed" : "open");
      return next;
    });

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? 72 : 248 }}
        className="hidden min-h-0 shrink-0 flex-col border-r border-border bg-surface-sidebar transition-[width] duration-200 md:flex"
      >
        <div className={`flex items-center border-b border-border py-4 ${collapsed ? "justify-center px-2" : "gap-2.5 px-4"}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-navy">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#dbe8fb" strokeWidth="2">
              <circle cx="12" cy="12" r="2.2" fill="var(--brand-orange)" stroke="none" />
              <circle cx="5" cy="6" r="1.4" /><circle cx="19" cy="6" r="1.4" /><circle cx="5" cy="18" r="1.4" /><circle cx="19" cy="18" r="1.4" />
              <path d="M6.4 6.8 10 11M17.6 6.8 14 11M6.4 17.2 10 13M17.6 17.2 14 13" />
            </svg>
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold tracking-tight text-foreground">Sinapse</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">XDi · Decision OS</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={toggleCollapse} aria-label="Collapse sidebar" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          )}
        </div>

        <RoleSwitcher collapsed={collapsed} />

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
          {NAV.map((g) => (
            <NavGroup key={g.heading} group={g} pathname={pathname} collapsed={collapsed} />
          ))}
        </nav>

        <div className="border-t border-border px-2.5 py-2">
          {BOTTOM.map((it) => (
            <NavLink key={it.label} item={it} active={false} collapsed={collapsed} />
          ))}
          {collapsed ? (
            <button onClick={toggleCollapse} aria-label="Expand sidebar" className="mt-1 grid h-9 w-full place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ) : (
            <p className="px-2.5 pb-1 pt-2 text-[10.5px] text-muted-foreground">AirPay Global Inc.</p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-5">
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-muted-foreground transition-colors hover:border-border-strong sm:flex sm:w-[340px]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
            <span className="flex-1 text-[13px]">Search objects, decisions, screens…</span>
            <span className="rounded border border-border px-1.5 font-mono text-[10px]">⌘K</span>
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            <AdvisorButton />
            <ThemeToggle />
          </div>
        </header>

        <ContextBar />

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          <div className="mx-auto max-w-[1520px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <EvidenceProvider>
      <DecisionProvider>
        <RoleProvider>
          <AdvisorProvider>
            <Shell>{children}</Shell>
          </AdvisorProvider>
        </RoleProvider>
      </DecisionProvider>
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
