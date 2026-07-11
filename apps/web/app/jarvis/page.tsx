import { PageHeader } from "@/components/app-shell";
import { JarvisView } from "./jarvis-view";

export default function JarvisPage() {
  return (
    <div>
      <PageHeader title="AI Jarvis" subtitle="Your Sinapse decision copilot — grounded in live platform data, honest about what isn't." />
      <JarvisView />
    </div>
  );
}
