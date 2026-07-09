"use client";

import Link from "next/link";
import { useState } from "react";
import { OBJECT_ICON, OBJECT_TYPES, STATUS_TEXT, STATUS_VAR, type ObjStatus } from "@/lib/ontology/catalogue";

const FILTERS: Array<{ key: "all" | ObjStatus; label: string }> = [
  { key: "all", label: "All objects" },
  { key: "live", label: "Live" },
  { key: "demo", label: "Demo" },
  { key: "planned", label: "Planned" },
];

function Icon({ k }: { k: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={OBJECT_ICON[k]} />
    </svg>
  );
}

export function ExplorerView() {
  const [filter, setFilter] = useState<"all" | ObjStatus>("all");
  const items = OBJECT_TYPES.filter((o) => filter === "all" || o.status === filter);

  return (
    <>
      <div className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ontology Explorer</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold text-foreground">Browse the objects, not the tables</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">
          Every value in Sinapse resolves to one of these canonical business objects. Open one to see its profile,
          relationships, metrics, evidence and lineage. Tags show which objects are live on the lakehouse today.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              filter === f.key ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(224px,1fr))]">
        {items.map((o) => {
          const inner = (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-primary">
                  <Icon k={o.icon} />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold text-card-foreground">{o.name}</div>
                  <div className="font-mono text-[10.5px] text-muted-foreground">{o.count !== null ? `${o.count} instances` : "— instances"}</div>
                </div>
              </div>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">{o.description}</p>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${STATUS_TEXT[o.status]}`} style={{ background: `color-mix(in srgb, ${STATUS_VAR[o.status]} 15%, transparent)` }}>
                  {o.status}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{o.goldOutput}</span>
              </div>
            </>
          );
          const cls = "flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5";
          return o.href ? (
            <Link key={o.slug} href={o.href} className={`${cls} transition-transform hover:-translate-y-0.5 hover:border-primary`}>
              {inner}
            </Link>
          ) : (
            <div key={o.slug} className={`${cls} ${o.status === "planned" ? "opacity-70" : ""}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </>
  );
}
