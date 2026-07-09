import { createOntology } from "@/lib/ontology/sdk";
import { AfcftaView } from "./afcfta-view";

export default async function AfcftaDashboard() {
  const onto = await createOntology();
  const corridor = await onto.corridors.gatewayActivity();
  return <AfcftaView corridor={corridor} />;
}
