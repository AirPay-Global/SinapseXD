import type { SdgIndicator } from "@sinapse/shared";
import { createOntology } from "@/lib/ontology/sdk";
import { sdgIndicators as demoSdgIndicators } from "@/lib/demo-data";
import { DfiView } from "./dfi-view";

// Static descriptive metadata the live feeds don't carry: a 2030 target
// (aspirational, not part of any API response) and a human label per
// indicator code. Values themselves come from gold_sdg_latest when live.
const INDICATOR_META: Record<string, { label: string; target: number }> = {
  "8.1.1": { label: "GDP growth per capita (annual %)", target: 5.0 },
  "9.1.2": { label: "Freight volumes by mode of transport (index)", target: 100 },
  "10.1.1": { label: "Growth of income, bottom 40% (%)", target: 4.5 },
  "17.1.1": { label: "Government revenue as % of GDP", target: 20 },
};

const PILOT_COUNTRIES = ["ZAF", "KEN", "NGA", "TGO", "DJI", "TZA", "GHA", "ZMB", "UGA", "RWA", "ETH", "BFA", "MLI", "NER"];

export default async function DfiDashboard() {
  const onto = await createOntology();
  const perCountry = await Promise.all(PILOT_COUNTRIES.map((iso3) => onto.countries.sdgIndicators(iso3)));
  const liveRows = perCountry.flatMap((r) => r.data);

  // Average each goal/indicator's value across whichever pilot countries
  // have a live reading — a continental-aggregate proxy, not a UN-published
  // AfCFTA aggregate (no such single official series exists).
  const byIndicator = new Map<string, { goal: number; sum: number; count: number }>();
  for (const row of liveRows) {
    const cur = byIndicator.get(row.indicator_code) ?? { goal: row.goal, sum: 0, count: 0 };
    cur.sum += row.value;
    cur.count += 1;
    byIndicator.set(row.indicator_code, cur);
  }

  const sdgLive: SdgIndicator[] = [...byIndicator.entries()].map(([code, { goal, sum, count }]) => ({
    country: "AfCFTA aggregate (pilot countries, live)",
    goal: goal as 8 | 9 | 10 | 17,
    indicatorCode: code,
    label: INDICATOR_META[code]?.label ?? code,
    value: sum / count,
    target: INDICATOR_META[code]?.target ?? 100,
    year: new Date().getFullYear(),
  }));

  const isLive = sdgLive.length > 0;

  return <DfiView sdg={isLive ? sdgLive : demoSdgIndicators()} sdgLive={isLive} />;
}
