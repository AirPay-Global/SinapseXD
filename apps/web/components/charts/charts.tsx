"use client";

/**
 * Chart primitives for Sinapse XD, built on Recharts with the validated
 * palette in lib/palette.ts.
 *
 * Dataviz rules enforced here:
 * - Categorical hues in fixed slot order, never cycled or repainted on filter.
 * - Single y-axis everywhere; no dual-axis charts.
 * - Thin marks: 2px lines, stacked segments separated by a 2px surface gap.
 * - Legend always rendered for ≥2 series; single series relies on the title.
 * - Hover tooltips on every plot; grid/axes recessive (hairline, muted ink).
 * - Text wears ink tokens, never the series colour.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_CHROME, seriesColor } from "@/lib/palette";

const AXIS_TICK = { fill: "var(--chart-ink-muted)", fontSize: 11 } as const;
const TOOLTIP_STYLE = {
  backgroundColor: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--chart-ink)",
} as const;
const LEGEND_STYLE = { fontSize: 12, color: "var(--chart-ink-secondary)" } as const;

function Grid() {
  return <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />;
}

// ── Multi-series line chart (time series) ───────────────
export function TrendLines({
  data,
  xKey,
  series,
  height = 280,
  yFormatter,
}: {
  data: object[];
  xKey: string;
  series: Array<{ key: string; label: string }>;
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <Grid />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          stroke={CHART_CHROME.axis}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={AXIS_TICK}
          stroke="transparent"
          tickLine={false}
          tickFormatter={yFormatter}
          width={52}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => (yFormatter ? yFormatter(v) : v)} />
        {series.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} iconType="plainline" />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            type="monotone"
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Stacked bars (composition over time) ────────────────
export function StackedBars({
  data,
  xKey,
  series,
  height = 280,
  yFormatter,
}: {
  data: object[];
  xKey: string;
  series: Array<{ key: string; label: string }>;
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
        <Grid />
        <XAxis dataKey={xKey} tick={AXIS_TICK} stroke={CHART_CHROME.axis} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS_TICK} stroke="transparent" tickLine={false} tickFormatter={yFormatter} width={52} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={seriesColor(i)}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Horizontal bars (ranked magnitude, single measure) ──
export function RankedBars({
  data,
  nameKey,
  valueKey,
  valueLabel,
  height = 280,
  formatter,
}: {
  data: object[];
  nameKey: string;
  valueKey: string;
  valueLabel: string;
  height?: number;
  formatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} stroke="transparent" tickLine={false} tickFormatter={formatter} />
        <YAxis
          type="category"
          dataKey={nameKey}
          tick={{ ...AXIS_TICK, fill: "var(--chart-ink-secondary)" }}
          stroke={CHART_CHROME.axis}
          tickLine={false}
          width={170}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          formatter={(v: number) => [formatter ? formatter(v) : v, valueLabel]}
        />
        <Bar dataKey={valueKey} name={valueLabel} fill={seriesColor(0)} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Grouped bars (comparison, ≤3 series) ────────────────
export function GroupedBars({
  data,
  xKey,
  series,
  height = 280,
  yFormatter,
}: {
  data: object[];
  xKey: string;
  series: Array<{ key: string; label: string }>;
  height?: number;
  yFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
        <Grid />
        <XAxis dataKey={xKey} tick={AXIS_TICK} stroke={CHART_CHROME.axis} tickLine={false} minTickGap={24} />
        <YAxis tick={AXIS_TICK} stroke="transparent" tickLine={false} tickFormatter={yFormatter} width={52} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
        {series.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={seriesColor(i)} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Progress-to-target bars (SDG indicators) ────────────
export function TargetBars({
  data,
  height = 300,
}: {
  data: Array<{ label: string; value: number; target: number; goal: number }>;
  height?: number;
}) {
  const rows = data.map((d) => ({
    ...d,
    pct: Math.min(100, Math.round((d.value / d.target) * 100)),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, bottom: 0, left: 8 }} barCategoryGap="34%">
        <XAxis type="number" domain={[0, 100]} tick={AXIS_TICK} stroke="transparent" tickLine={false} tickFormatter={(v: number) => `${v}%`} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS_TICK, fill: "var(--chart-ink-secondary)" }}
          stroke={CHART_CHROME.axis}
          tickLine={false}
          width={230}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          formatter={(v: number) => [`${v}% of target`, "Progress"]}
        />
        <Bar dataKey="pct" name="Progress to target" radius={[0, 4, 4, 0]} background={{ fill: "var(--muted)", radius: 4 }}>
          {rows.map((row, i) => (
            // Colour follows the SDG goal (entity), not the bar's rank
            <Cell key={i} fill={seriesColor([8, 9, 10, 17].indexOf(row.goal))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
