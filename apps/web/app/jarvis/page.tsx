import { PageHeader } from "@/components/app-shell";
import { JarvisView } from "./jarvis-view";

export default function JarvisPage() {
  return (
    <div>
      <PageHeader title="AI Advisors" subtitle="Thirteen domain specialists, each grounded in your stakeholder context and live platform data — honest about what isn't live." />
      <JarvisView />
    </div>
  );
}
