import Link from "next/link";
import { PageHeader } from "@/components/app-shell";

type Stakeholder = {
  name: string;
  category: string;
  description: string;
  status: "live" | "planned";
  href?: string;
};

const STAKEHOLDERS: Stakeholder[] = [
  { name: "Port Authority", category: "Operator", description: "Berth utilisation, vessel queue, revenue vs. forecast.", status: "live", href: "/dashboard/port" },
  { name: "Government & Policy", category: "Government", description: "Corridor performance, trade-cost tracking, APRM exports.", status: "live", href: "/dashboard/government" },
  { name: "DFI Investment", category: "Finance", description: "SDG-indicator dashboards, infrastructure ROI, impact measurement.", status: "live", href: "/dashboard/dfi" },
  { name: "AfCFTA Secretariat", category: "Continental Body", description: "Continental trade flow, Digital Trade Protocol compliance.", status: "live", href: "/dashboard/afcfta" },
  { name: "Terminal Operator", category: "Operator", description: "Container yard throughput, equipment utilisation.", status: "planned" },
  { name: "Shipping Line", category: "Operator", description: "Vessel schedule adherence, port-call cost benchmarking.", status: "planned" },
  { name: "Customs Authority", category: "Government", description: "Clearance times, rules-of-origin verification.", status: "planned" },
  { name: "Ministry of Trade", category: "Government", description: "Bilateral/regional trade flow monitoring.", status: "planned" },
  { name: "Transport Ministry", category: "Government", description: "Corridor infrastructure planning, multimodal performance.", status: "planned" },
  { name: "Afreximbank", category: "Finance", description: "Trade finance exposure, blended-finance signals.", status: "planned" },
  { name: "APRM", category: "Continental Body", description: "Governance & SDG monitoring feeds.", status: "planned" },
  { name: "African Union", category: "Continental Body", description: "Continental integration scorecards.", status: "planned" },
  { name: "Investors", category: "Finance", description: "Infrastructure deal-flow and risk signals.", status: "planned" },
  { name: "Exporters / Importers", category: "Trader", description: "Corridor cost & transit-time intelligence.", status: "planned" },
];

export default function StakeholdersPage() {
  return (
    <div>
      <PageHeader
        title="Stakeholders"
        subtitle="Sinapse XD serves 14 stakeholder types across the AfCFTA trade ecosystem. Four have live command centres today; the rest are planned as the platform expands."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAKEHOLDERS.map((s) => {
          const card = (
            <div className={`h-full rounded-xl border border-border bg-card p-5 ${s.href ? "transition-colors hover:border-primary/40" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-[15px] font-semibold text-foreground">{s.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide ${
                    s.status === "live" ? "bg-success/10 text-success" : "border border-border text-muted-foreground"
                  }`}
                >
                  {s.status === "live" ? "Live" : "Planned"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{s.category}</p>
              <p className="mt-2.5 text-[13px] text-muted-foreground">{s.description}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.name} href={s.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={s.name}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
