import { GEOS, type Layer } from "./catalogue";

/**
 * Canvas analysis (spec §14 structured commentary + §15 guardrails). Pure,
 * deterministic reads of the active layers — Pearson correlation, missing
 * data, provenance — expressed in guardrailed language (association, not
 * causation). This always works offline; the AI Advisor elaborates on top.
 */

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
}

export function strength(r: number): string {
  const a = Math.abs(r);
  return a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "negligible";
}

export interface Commentary {
  shows: string;
  changed: string;
  matters: string;
  alternatives: string[];
  limitations: string[];
  confidence: "High" | "Medium" | "Low";
  next: string;
}

/** Local, guardrailed structured read of the current canvas. */
export function localCommentary(layers: Layer[], addedId: string | null): Commentary {
  if (layers.length === 0) {
    return { shows: "No layers on the canvas yet.", changed: "", matters: "Add a dataset to begin.", alternatives: [], limitations: [], confidence: "Low", next: "Start from a template or add a first layer." };
  }
  const primary = layers[0];
  if (layers.length === 1) {
    const vals = primary.values;
    const max = Math.max(...vals), min = Math.min(...vals);
    const top = GEOS[vals.indexOf(max)].name, bottom = GEOS[vals.indexOf(min)].name;
    return {
      shows: `${primary.name} ranges from ${min} to ${max} ${primary.unit} across the pilot gateways, highest at ${top} and lowest at ${bottom}.`,
      changed: "",
      matters: `${top} stands out on this measure; whether that is good or a risk depends on the metric (${primary.higherIsBetter ? "higher is better" : "lower is better"} here).`,
      alternatives: ["Ranking reflects only the pilot set, not the full continental picture."],
      limitations: [primary.status !== "live" ? `${primary.name} is ${primary.status} data — illustrative, not a live measurement.` : "Live feed, but a 7-gateway sample."],
      confidence: primary.status === "live" ? "High" : "Medium",
      next: "Add a second layer to look for a relationship.",
    };
  }
  const a = layers[0], b = layers[1];
  const r = pearson(a.values, b.values);
  const dir = r >= 0 ? "positively" : "negatively";
  const s = strength(r);
  const added = addedId ? layers.find((l) => l.id === addedId) : null;
  const anyDemo = layers.some((l) => l.status !== "live");
  return {
    shows: `Across the pilot gateways, ${a.name} and ${b.name} are ${dir} associated (r = ${r}, ${s}).`,
    changed: added ? `Adding ${added.name} surfaced a ${s} ${dir === "positively" ? "positive" : "negative"} association with ${a.name} that a single-layer view could not show.` : `The two layers move ${dir === "positively" ? "together" : "in opposite directions"}.`,
    matters: r <= -0.4 ? `Where ${b.name} is higher, ${a.name} tends to be lower — worth understanding which is driving which.` : r >= 0.4 ? `The two rise together — a lever on one may move the other, but that is an association, not proof.` : `The relationship is ${s}; treat any read with caution.`,
    alternatives: [
      "A third factor (port size, corridor role, season) could drive both.",
      "The direction of any effect cannot be established from this view alone.",
    ],
    limitations: [
      `${GEOS.length}-gateway sample — small n, so a single outlier can move the correlation.`,
      anyDemo ? "Some layers are Demo/illustrative and not suitable for an official conclusion." : "Live layers, but a limited geography.",
      layers.length > 2 ? `Correlation shown for the top two layers only; ${layers.length - 2} further layer(s) are on the canvas.` : "Cross-sectional snapshot, not a time series.",
    ],
    confidence: Math.abs(r) >= 0.7 && !anyDemo ? "High" : Math.abs(r) >= 0.4 ? "Medium" : "Low",
    next: r <= -0.4 || r >= 0.4 ? `Add a time overlay to see whether the association holds over the period, or open the evidence on ${b.name}.` : "Swap in a different second layer to test other relationships.",
  };
}
