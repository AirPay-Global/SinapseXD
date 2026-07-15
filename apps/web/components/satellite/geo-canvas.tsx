"use client";

import type { Berth, VesselTrack } from "@/lib/satellite/types";

/**
 * Geospatial canvas (spec §5 centre panel). A lightweight SVG basemap — the
 * same "swap for Mapbox later" contract as the existing VesselMap — rendering
 * vessel tracks, berth polygons (coloured by lifecycle state), port/terminal
 * geometry and anchorage, gated by the active layer set. Deliberately not a
 * real tile map: there's no imagery pipeline yet, and the guardrail (spec §14)
 * is to never dress demo geometry up as a live satellite basemap.
 */

const STATE_FILL: Record<Berth["state"], string> = {
  candidate: "var(--chart-grid)",
  machine_inferred: "var(--warning)",
  analyst_reviewed: "var(--info)",
  port_verified: "var(--success)",
  published: "var(--success)",
  rejected: "var(--destructive)",
  superseded: "var(--muted-foreground)",
};

export function GeoCanvas({
  berths,
  tracks,
  active,
  selectedBerth,
  selectedVessel,
  onSelectBerth,
  onSelectVessel,
}: {
  berths: Berth[];
  tracks: VesselTrack[];
  active: Set<string>;
  selectedBerth?: string;
  selectedVessel?: string;
  onSelectBerth: (id: string) => void;
  onSelectVessel: (mmsi: string) => void;
}) {
  const on = (id: string) => active.has(id);

  return (
    <svg viewBox="0 0 100 64" className="w-full rounded-lg border border-border bg-[color:var(--background)]" role="img" aria-label="Satellite intelligence geospatial canvas">
      {/* water tint + graticule */}
      <rect x="0" y="0" width="100" height="64" fill="color-mix(in srgb, var(--info) 5%, var(--background))" />
      {[13, 26, 39, 52].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--chart-grid)" strokeWidth="0.12" />
      ))}
      {[20, 40, 60, 80].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="64" stroke="var(--chart-grid)" strokeWidth="0.12" />
      ))}

      {/* landmass / quay backing */}
      {on("port_boundary") && (
        <path d="M12,44 Q50,38 88,44 L88,64 L12,64 Z" fill="color-mix(in srgb, var(--muted-foreground) 14%, var(--background))" stroke="var(--border)" strokeWidth="0.2" />
      )}

      {/* terminal boundaries */}
      {on("terminal_boundary") &&
        [22, 44, 66].map((x, i) => (
          <rect key={i} x={x} y="36" width="18" height="10" rx="0.8" fill="none" stroke="var(--border)" strokeWidth="0.25" strokeDasharray="1 0.8" />
        ))}

      {/* anchorage areas */}
      {on("anchorage") && (
        <g>
          <circle cx="80" cy="14" r="9" fill="none" stroke="var(--chart-3)" strokeWidth="0.25" strokeDasharray="1.2 0.8" />
          <text x="80" y="14.6" fontSize="2" fill="var(--chart-ink-secondary)" textAnchor="middle">Anchorage</text>
        </g>
      )}

      {/* vessel tracks */}
      {on("vessel_tracks") &&
        tracks.map((v) => {
          const d = v.track.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
          const sel = v.mmsi === selectedVessel;
          const col = v.source === "satellite" ? "var(--chart-7)" : "var(--chart-1)";
          return (
            <path key={v.mmsi} d={d} fill="none" stroke={col} strokeWidth={sel ? 0.7 : 0.4}
              strokeDasharray={v.source === "satellite" ? "1.4 0.8" : undefined} opacity={sel ? 1 : 0.75} />
          );
        })}

      {/* current vessel positions (head of each track) */}
      {on("vessel_positions") &&
        tracks.map((v) => {
          const head = v.track[v.track.length - 1];
          const sel = v.mmsi === selectedVessel;
          return (
            <g key={`p-${v.mmsi}`} transform={`translate(${head[0]} ${head[1]}) rotate(${v.headingDeg})`} className="cursor-pointer" onClick={() => onSelectVessel(v.mmsi)}>
              <path d="M0,-1.6 L1.1,1.3 L-1.1,1.3 Z" fill={v.source === "satellite" ? "var(--chart-7)" : "var(--chart-1)"} stroke="var(--background)" strokeWidth="0.25" />
              {sel && <circle r="2.4" fill="none" stroke="var(--primary)" strokeWidth="0.4" />}
            </g>
          );
        })}

      {/* berths */}
      {berths.map((b) => {
        const isCandidate = b.state === "candidate" || b.state === "machine_inferred";
        if (isCandidate && !on("candidate_berths")) return null;
        if (!isCandidate && !on("confirmed_berths")) return null;
        const pts = b.polygon.map((p) => `${p[0]},${p[1]}`).join(" ");
        const sel = b.id === selectedBerth;
        return (
          <g key={b.id} className="cursor-pointer" onClick={() => onSelectBerth(b.id)}>
            {on("confidence_heat") && <circle cx={b.x} cy={b.y} r={5} fill={STATE_FILL[b.state]} opacity={0.08 + b.confidence * 0.22} />}
            <polygon points={pts} transform={`rotate(${b.orientationDeg - 90} ${b.x} ${b.y})`}
              fill={STATE_FILL[b.state]} opacity={isCandidate ? 0.45 : 0.7}
              stroke={sel ? "var(--primary)" : STATE_FILL[b.state]} strokeWidth={sel ? 0.6 : 0.25}
              strokeDasharray={isCandidate ? "0.8 0.5" : undefined} />
            {b.occupied && <circle cx={b.x} cy={b.y} r="0.7" fill="var(--foreground)" />}
          </g>
        );
      })}
    </svg>
  );
}
