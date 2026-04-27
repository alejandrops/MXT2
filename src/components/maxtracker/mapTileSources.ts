// ═══════════════════════════════════════════════════════════════
//  Shared Leaflet tile sources
//  ─────────────────────────────────────────────────────────────
//  Centralized so every map component (FleetMap, RouteMap,
//  TripsMap, AssetMiniMap, etc.) uses the same providers without
//  duplicating URLs and attribution strings.
//
//  See MapLayerToggle.tsx for the user-facing layer switcher.
// ═══════════════════════════════════════════════════════════════

import type { MapLayer } from "./MapLayerToggle";

export interface TileSource {
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string;
}

export const TILE_SOURCES: Record<MapLayer, TileSource> = {
  STANDARD: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap",
    maxZoom: 19,
    subdomains: "abc",
  },
  BW: {
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap, © CARTO",
    maxZoom: 19,
    subdomains: "abcd",
  },
  SATELLITE: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — i-cubed, USDA, USGS, AEX",
    maxZoom: 19,
  },
};
