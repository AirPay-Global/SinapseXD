/**
 * Sinapse XD chart palette.
 *
 * Both modes validated with the dataviz six-checks validator against their
 * actual chart surfaces (light #FFFFFF, dark card #0D2B4E):
 * lightness band, chroma floor, adjacent-pair CVD separation, contrast — PASS.
 *
 * Rules baked into the chart components:
 * - Categorical hues assigned in this fixed slot order, never cycled or repainted.
 * - More than 8 series folds into "Other" — a 9th hue is never generated.
 * - Sequential encoding uses one hue (blue) light→dark; diverging is blue↔red
 *   with a neutral gray midpoint.
 * - Status colours (success/warning/destructive/info tokens) are never used as
 *   series colours.
 */
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** Sequential blue ramp (light→dark) for magnitude encodings (heatmaps, chorolepths). */
export const SEQUENTIAL_BLUE = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#1b6cc8",
  "#15568f",
  "#0d3c66",
] as const;

export const CHART_CHROME = {
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  ink: "var(--chart-ink)",
  inkSecondary: "var(--chart-ink-secondary)",
  inkMuted: "var(--chart-ink-muted)",
} as const;

export function seriesColor(index: number): string {
  return CHART_SERIES[Math.min(index, CHART_SERIES.length - 1)];
}
