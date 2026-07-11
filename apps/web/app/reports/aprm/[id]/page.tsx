import { notFound } from "next/navigation";
import { getAprmReport } from "@/lib/reporting/aprm-report";
import { AprmReportDetail } from "./report-detail";

export default async function AprmReportDetailPage({ params }: { params: { id: string } }) {
  const report = await getAprmReport(params.id);
  if (!report) notFound();
  return <AprmReportDetail report={report} />;
}
