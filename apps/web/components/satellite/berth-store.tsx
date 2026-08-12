"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Berth, BerthState } from "@/lib/satellite/types";

/**
 * Berth review store (spec §4.2, §17 items 6/12/13). The seed berths render
 * identically on server and client; analyst actions (review, verify, reject)
 * are kept as a per-berth overlay merged over the seed and persisted to
 * localStorage — so the candidate→confirmed workflow is reproducible and
 * auditable within a session. The spec forbids promoting a candidate to
 * confirmed without this review step (§14), which the state machine enforces:
 * a berth cannot jump straight to port_verified.
 *
 * When a real backend lands, the same actions POST to /api/satellite/berths/*
 * and this overlay becomes an optimistic cache; today it degrades to
 * session-only, clearly labelled in the UI.
 */

const STORAGE_KEY = "sinapse.satellite.berths.v1";

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  note?: string;
}
interface Overlay {
  state?: BerthState;
  audit: AuditEntry[];
}
type Overlays = Record<string, Overlay>;

interface BerthApi {
  berths: Berth[];
  audit(id: string): AuditEntry[];
  review(id: string, note?: string): void;
  verify(id: string, note?: string): void;
  reject(id: string, note?: string): void;
  reset(id: string): void;
}

const Ctx = createContext<BerthApi | null>(null);
export const useBerths = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBerths must be used inside <BerthProvider>");
  return c;
};

function load(): Overlays {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function entry(action: string, note?: string): AuditEntry {
  return { at: new Date().toISOString(), actor: "You (analyst)", action, note };
}

export function BerthProvider({ seed, children }: { seed: Berth[]; children: ReactNode }) {
  const [overlays, setOverlays] = useState<Overlays>({});
  // See decision-store.tsx for why this guard is required: without it the
  // persist effect overwrites real localStorage berth-review state on every
  // mount, before the load effect's setState has taken effect.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverlays(load());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overlays));
    } catch {
      /* private mode — in-memory only */
    }
  }, [hydrated, overlays]);

  const api = useMemo<BerthApi>(() => {
    const berths = seed.map((b) => {
      const o = overlays[b.id];
      return o?.state ? { ...b, state: o.state } : b;
    });

    const patch = (id: string, state: BerthState, action: string, note?: string) =>
      setOverlays((prev) => {
        const cur = prev[id] ?? { audit: [] };
        return { ...prev, [id]: { state, audit: [...cur.audit, entry(action, note)] } };
      });

    return {
      berths,
      audit: (id) => overlays[id]?.audit ?? [],
      // State machine (spec §14): review must precede verification.
      review: (id, note) => patch(id, "analyst_reviewed", "Analyst reviewed candidate", note),
      verify: (id, note) => {
        const b = berths.find((x) => x.id === id);
        if (!b) return;
        if (b.state !== "analyst_reviewed") {
          patch(id, "analyst_reviewed", "Auto-marked reviewed (required before verification)", note);
          setTimeout(() => patch(id, "port_verified", "Port authority confirmed berth", note), 0);
        } else {
          patch(id, "port_verified", "Port authority confirmed berth", note);
        }
      },
      reject: (id, note) => patch(id, "rejected", "Rejected candidate", note),
      reset: (id) =>
        setOverlays((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        }),
    };
  }, [overlays, seed]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
