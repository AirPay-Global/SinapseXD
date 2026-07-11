import { PageHeader } from "@/components/app-shell";
import { IntelligenceView } from "./intelligence-view";

export default function IntelligencePage() {
  return (
    <div>
      <PageHeader
        title="Intelligence Centre"
        subtitle="Forecasting, root cause, anomalies, opportunities, early warnings and briefings — every value opens its evidence."
      />
      <IntelligenceView />
    </div>
  );
}
