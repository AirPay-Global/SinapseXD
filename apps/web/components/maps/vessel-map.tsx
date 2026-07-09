import type { VesselPosition } from "@sinapse/shared";

/**
 * Lightweight SVG vessel plot used until the Mapbox token is provisioned
 * (NEXT_PUBLIC_MAPBOX_TOKEN). Same data contract as the Mapbox layer, so the
 * swap is a rendering change only.
 */
export function VesselMap({
  vessels,
  center,
}: {
  vessels: VesselPosition[];
  center: { lat: number; lng: number; name: string };
}) {
  const span = 5; // degrees each side of the port
  const project = (lat: number, lng: number) => ({
    x: ((lng - center.lng + span) / (span * 2)) * 100,
    y: ((center.lat + span - lat) / (span * 2)) * 100,
  });
  const statusColor: Record<VesselPosition["status"], string> = {
    underway: "var(--chart-1)",
    at_anchor: "var(--chart-3)",
    expected: "var(--chart-7)",
    moored: "var(--chart-5)",
    delayed: "var(--chart-6)",
  };
  const legend: Array<[VesselPosition["status"], string]> = [
    ["underway", "Underway"],
    ["at_anchor", "At anchor"],
    ["expected", "Expected"],
    ["delayed", "Delayed"],
  ];

  return (
    <div>
      <svg viewBox="0 0 100 62" className="w-full rounded-lg border border-border bg-background" role="img" aria-label={`Vessel positions around ${center.name}`}>
        {/* graticule */}
        {[12.4, 24.8, 37.2, 49.6].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--chart-grid)" strokeWidth="0.15" />
        ))}
        {[20, 40, 60, 80].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="62" stroke="var(--chart-grid)" strokeWidth="0.15" />
        ))}
        {/* port marker */}
        <circle cx="50" cy="31" r="1.6" fill="var(--foreground)" />
        <text x="52.5" y="31.9" fontSize="2.6" fill="var(--chart-ink-secondary)">
          {center.name}
        </text>
        {/* vessels */}
        {vessels.map((v) => {
          const p = project(v.lat, v.lng);
          const y = (p.y * 62) / 100;
          return (
            <g key={v.mmsi || v.imo} transform={`translate(${p.x} ${y}) rotate(${v.heading})`}>
              <path d="M0,-1.5 L1,1.2 L-1,1.2 Z" fill={statusColor[v.status]} stroke="var(--background)" strokeWidth="0.25">
                <title>{`${v.name} · ${v.type} · ${v.speedKn} kn · ${v.status.replace("_", " ")}`}</title>
              </path>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4">
        {legend.map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: statusColor[status] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
