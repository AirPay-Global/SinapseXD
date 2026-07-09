import { getCorridorGatewayActivity } from "@/lib/gold";
import { GovernmentView } from "./government-view";

export default async function GovernmentDashboard() {
  const corridor = await getCorridorGatewayActivity();
  return <GovernmentView corridor={corridor} />;
}
