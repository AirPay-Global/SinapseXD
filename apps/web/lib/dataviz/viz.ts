/** Visualisation types the canvas supports (spec §9, MVP subset). */
export type VizType = "map" | "scatter" | "bar" | "line" | "heatmap" | "network";

export const VIZ_META: Record<VizType, { label: string; icon: string; needs: string; minLayers: number }> = {
  map: { label: "Map", icon: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15", needs: "1–2 layers (size · colour)", minLayers: 1 },
  scatter: { label: "Scatter", icon: "M5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M10 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M15 14a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M19 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M4 20V4M4 20h16", needs: "exactly 2 layers (x · y)", minLayers: 2 },
  bar: { label: "Bar", icon: "M4 20V10M10 20V4M16 20v-7M4 20h16", needs: "1+ layers", minLayers: 1 },
  line: { label: "Line", icon: "M4 4v16h16M8 14l3-3 2 2 5-6", needs: "1+ layers (12-month series)", minLayers: 1 },
  heatmap: { label: "Heatmap", icon: "M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16", needs: "1+ layers (geo × layer)", minLayers: 1 },
  network: { label: "Network", icon: "M6 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 4h12M6 4l6 14M18 4l-6 14", needs: "ontology chain", minLayers: 1 },
};

export const VIZ_TYPES: VizType[] = ["map", "scatter", "bar", "line", "heatmap", "network"];
