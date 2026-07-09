import { createOntology } from "@/lib/ontology/sdk";
import { GovernmentView } from "./government-view";

export default async function GovernmentDashboard() {
  const onto = await createOntology();
  const corridor = await onto.corridors.gatewayActivity();
  return <GovernmentView corridor={corridor} />;
}
