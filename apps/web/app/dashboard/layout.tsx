import type { ReactNode } from "react";

// The Decision OS shell (with the Evidence drawer provider) is applied once in
// the root layout, so stakeholder command centres just render their content.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
