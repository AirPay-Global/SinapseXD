"use client";

import type { OccupancySlot } from "@/lib/satellite/types";

/**
 * Berth occupancy timeline (spec §4.3). A 14-day Gantt of who was alongside
 * each berth. Inferred from AIS arrival/departure events — labelled as such,
 * not presented as a verified port record.
 */
export function OccupancyTimeline({ slots }: { slots: OccupancySlot[] }) {
  const days = 14;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pl-[120px] text-[9px] text-muted-foreground">
        {Array.from({ length: days }, (_, i) => (
          <span key={i} className="flex-1 text-center">D{i + 1}</span>
        ))}
      </div>
      {slots.map((s) => (
        <div key={s.berthId} className="flex items-center gap-2">
          <span className="w-[112px] shrink-0 truncate text-[11px] font-medium text-foreground">{s.berthName}</span>
          <div className="relative h-5 flex-1 rounded bg-muted/50">
            {s.segments.map((seg, i) => {
              const left = (seg.start / days) * 100;
              const width = ((seg.end - seg.start) / days) * 100;
              return (
                <div
                  key={i}
                  title={`${seg.vessel} · ${seg.vesselClass} · day ${seg.start}–${seg.end}`}
                  className="absolute top-0.5 bottom-0.5 rounded-[3px] bg-primary/70 hover:bg-primary"
                  style={{ left: `${left}%`, width: `${Math.max(1.5, width)}%` }}
                />
              );
            })}
          </div>
        </div>
      ))}
      <p className="pl-[120px] pt-1 text-[10px] text-muted-foreground">
        Occupancy inferred from AIS arrival/departure events over the last 14 days — not a verified port record.
      </p>
    </div>
  );
}
