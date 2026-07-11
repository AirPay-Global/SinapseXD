import { PageHeader } from "@/components/app-shell";
import { WorkflowView } from "./workflow-view";

export default function WorkflowPage() {
  return (
    <div>
      <PageHeader
        title="Workflow Centre"
        subtitle="Insight → Recommendation → Approval → Workflow → Tasks → Execution → Monitoring → Outcome — every decision on one board."
      />
      <WorkflowView />
    </div>
  );
}
