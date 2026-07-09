import { getCorridorGatewayActivity } from "@/lib/gold";
import { AfcftaView } from "./afcfta-view";

export default async function AfcftaDashboard() {
  const corridor = await getCorridorGatewayActivity();
  return <AfcftaView corridor={corridor} />;
}
