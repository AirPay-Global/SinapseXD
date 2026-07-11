"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Current-stakeholder context (spec Priority 2). The role picked in the
 * sidebar is what grounds the AI advisors: stakeholder, organisation, home
 * country/port and objectives all travel with every advisor request.
 * Persisted so the platform reopens as the same persona.
 */

export interface Role {
  code: string;
  name: string;
  org: string;
  href: string;
  /** Matches DecisionItem.stakeholder for filtering. */
  stakeholder: string;
  country: string;
  port: string | null;
  objectives: string;
}

export const ROLES: Role[] = [
  {
    code: "PC", name: "Port CEO", org: "Port of Durban", href: "/dashboard/port",
    stakeholder: "Port Authority", country: "South Africa (ZAF)", port: "port:durban",
    objectives: "Grow throughput and revenue, hold congestion below peer ports, retain anchor shipping lines.",
  },
  {
    code: "GP", name: "Policy Director", org: "Dept. of Trade", href: "/dashboard/government",
    stakeholder: "Government & Policy", country: "South Africa (ZAF)", port: null,
    objectives: "Cut corridor trade costs, lift intra-AfCFTA trade share, hit SDG 8/9/10/17 targets.",
  },
  {
    code: "DX", name: "DFI Executive", org: "Development Bank", href: "/dashboard/dfi",
    stakeholder: "DFI Investment", country: "Pan-African portfolio", port: null,
    objectives: "Deploy capital where impact evidence is strongest; verify covenants; measure development outcomes.",
  },
  {
    code: "AA", name: "AfCFTA Analyst", org: "AfCFTA Secretariat", href: "/dashboard/afcfta",
    stakeholder: "AfCFTA Monitoring", country: "Continental (55 states)", port: null,
    objectives: "Monitor protocol compliance, rules-of-origin verification and landlocked-economy inclusion.",
  },
];

const STORAGE_KEY = "sinapse.role";

interface RoleApi {
  role: Role;
  roleIndex: number;
  setRoleIndex: (i: number) => void;
}

const RoleContext = createContext<RoleApi>({ role: ROLES[0], roleIndex: 0, setRoleIndex: () => {} });
export const useRole = () => useContext(RoleContext);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    try {
      const i = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isInteger(i) && i >= 0 && i < ROLES.length) setRoleIndex(i);
    } catch { /* private mode */ }
  }, []);

  const pick = (i: number) => {
    setRoleIndex(i);
    try {
      localStorage.setItem(STORAGE_KEY, String(i));
    } catch { /* private mode */ }
  };

  return <RoleContext.Provider value={{ role: ROLES[roleIndex], roleIndex, setRoleIndex: pick }}>{children}</RoleContext.Provider>;
}
