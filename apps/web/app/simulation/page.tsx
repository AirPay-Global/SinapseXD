import { PageHeader } from "@/components/app-shell";
import { SimulationView } from "./simulation-view";

export default function SimulationPage({ searchParams }: { searchParams: { decision?: string } }) {
  return (
    <div>
      <PageHeader
        title="Simulation Centre"
        subtitle="What-if analysis on every recommendation — investment, capacity, dwell and tariff levers with modelled trade, GDP, jobs, carbon and ROI."
      />
      <SimulationView decisionId={searchParams.decision} />
    </div>
  );
}
