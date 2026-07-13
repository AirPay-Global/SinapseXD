import { ReportWorkspace } from "./report-workspace";

export default function ReportPage({ params }: { params: { id: string } }) {
  return <ReportWorkspace id={params.id} />;
}
