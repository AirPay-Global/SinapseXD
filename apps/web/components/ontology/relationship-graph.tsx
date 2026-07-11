"use client";

import { useRouter } from "next/navigation";
import type { Relationship } from "@/components/ontology/object-profile";

/**
 * Relationship graph (UI Evolution spec, Priority 4): the object's linked
 * ontology objects as a navigable radial graph instead of a flat chip list.
 * Pure SVG — nodes with an href navigate on click, edge labels carry the
 * relationship kind. Everything is connected; everything is one hop away.
 */

export function RelationshipGraph({ center, relationships }: { center: string; relationships: Relationship[] }) {
  const router = useRouter();
  const W = 460;
  const H = Math.max(240, 150 + relationships.length * 14);
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2 - 86;
  const ry = H / 2 - 40;

  const nodes = relationships.map((r, i) => {
    // Start at -90° (top) and space evenly around the ellipse.
    const angle = -Math.PI / 2 + (i / relationships.length) * 2 * Math.PI;
    return { ...r, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Relationship graph for ${center}`}>
      {nodes.map((n, i) => {
        const mx = (cx + n.x) / 2;
        const my = (cy + n.y) / 2;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="var(--border)" strokeWidth="1.2" />
            <rect x={mx - n.kind.length * 2.6 - 4} y={my - 7} width={n.kind.length * 5.2 + 8} height={14} rx={7} fill="var(--card)" stroke="var(--border)" strokeWidth="0.8" />
            <text x={mx} y={my + 3} textAnchor="middle" fontSize="8.5" fill="var(--muted-foreground)" fontFamily="var(--font-mono, monospace)">
              {n.kind}
            </text>
          </g>
        );
      })}

      {nodes.map((n, i) => {
        const w = Math.max(64, n.label.length * 6.4 + 18);
        const clickable = !!n.href;
        return (
          <g
            key={`n${i}`}
            onClick={() => n.href && router.push(n.href)}
            className={clickable ? "cursor-pointer" : undefined}
            role={clickable ? "link" : undefined}
          >
            <rect x={n.x - w / 2} y={n.y - 13} width={w} height={26} rx={8} fill="var(--background)" stroke={clickable ? "var(--brand-blue)" : "var(--border)"} strokeWidth={clickable ? 1.4 : 1} />
            <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={clickable ? "var(--brand-blue)" : "var(--foreground)"}>
              {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
            </text>
          </g>
        );
      })}

      {/* Centre node on top */}
      <g>
        <rect x={cx - Math.max(46, center.length * 3.6 + 14)} y={cy - 16} width={Math.max(92, center.length * 7.2 + 28)} height={32} rx={10} fill="var(--brand-navy)" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
          {center}
        </text>
      </g>
    </svg>
  );
}
