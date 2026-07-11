import { createOntology } from "@/lib/ontology/sdk";
import { GovernmentView } from "./government-view";

export default async function GovernmentDashboard() {
  const onto = await createOntology();
  const [corridor, freight] = await Promise.all([onto.corridors.gatewayActivity(), onto.market.freightIndex()]);
  return <GovernmentView corridor={corridor} freight={freight} />;
}
