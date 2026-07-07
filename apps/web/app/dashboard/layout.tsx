import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <main className="px-6 py-8 lg:px-10">{children}</main>
    </AppShell>
  );
}
