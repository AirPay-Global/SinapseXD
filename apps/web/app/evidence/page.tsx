import { PageHeader } from "@/components/app-shell";
import { EvidenceCentreView } from "./evidence-view";

export default function EvidencePage() {
  return (
    <div>
      <PageHeader title="Evidence Centre" subtitle="Every number, traced from source to decision." />
      <EvidenceCentreView />
    </div>
  );
}
