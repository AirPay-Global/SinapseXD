"use client";

import { useRole } from "@/components/role-context";

/**
 * Persistent context bar (XDi modernisation §8). A compact strip below the top
 * bar that states exactly what scope the user is viewing — role, organisation,
 * country, port, reporting period and data posture — so cards no longer repeat
 * that context inline. Reads the live role from RoleProvider.
 */

function Seg({ label, value, tone }: { label: string; value: string; tone?: "live" | "demo" }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-medium ${tone === "live" ? "text-success" : tone === "demo" ? "text-warning" : "text-foreground"}`}>{value}</span>
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px shrink-0 bg-border" aria-hidden />;
}

export function ContextBar() {
  const { role } = useRole();
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-surface-muted px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden print:hidden">
      <Seg label="Role" value={role.name} />
      <Divider />
      <Seg label="Org" value={role.org} />
      <Divider />
      <Seg label="Country" value={role.country} />
      {role.port && (
        <>
          <Divider />
          <Seg label="Port" value={role.port.replace("port:", "")} />
        </>
      )}
      <Divider />
      <Seg label="Period" value="Jul 2026" />
      <Divider />
      {/* Data posture — a non-colour cue (● dot) pairs with the colour per §6/§22 */}
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">Data</span>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />Live
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />+ Demo
        </span>
      </span>
      <Divider />
      <Seg label="Env" value="Production" />
    </div>
  );
}
