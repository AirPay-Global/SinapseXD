import { PageHeader } from "@/components/app-shell";
import { DEMO_ORG_ID, listAprmReports } from "@/lib/reporting/aprm-report";
import { AprmReportsView } from "./aprm-reports-view";

export default async function AprmReportsPage() {
  const reports = await listAprmReports(DEMO_ORG_ID);
  return (
    <div>
      <PageHeader
        title="APRM Reports"
        subtitle="Automated monitoring summaries for African Peer Review Mechanism reporting — SDG progress and corridor performance, generated on demand."
      />
      <AprmReportsView
        initialReports={reports.map((r) => ({ id: r.id, period: r.period, title: r.title, status: r.status, generatedAt: r.generated_at }))}
      />
    </div>
  );
}
