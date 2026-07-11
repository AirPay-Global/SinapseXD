import { PageHeader } from "@/components/app-shell";
import { TwinView } from "./twin-view";

export default function TwinPage() {
  return (
    <div>
      <PageHeader
        title="Digital Twin"
        subtitle="Africa → Region → Country → Corridor → Port → Terminal → Berth → Vessel → Container — one continuous drill through live trade and infrastructure."
      />
      <TwinView />
    </div>
  );
}
