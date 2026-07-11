import { DecisionDetail } from "./decision-detail";

export default function DecisionDetailPage({ params }: { params: { id: string } }) {
  return <DecisionDetail id={params.id} />;
}
