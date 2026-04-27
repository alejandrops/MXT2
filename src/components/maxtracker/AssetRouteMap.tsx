"use client";

import dynamic from "next/dynamic";
import styles from "./AssetMiniMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetRouteMap · public wrapper for AssetMiniMap
//  ─────────────────────────────────────────────────────────────
//  Same dynamic-import pattern as <LeafletMap>: defer the actual
//  Leaflet renderer to the client (ssr:false) so server pages can
//  import this module without pulling Leaflet code into the SSR
//  pass.
//
//  Used by the Overview tab in /gestion/vehiculos/[id] to render
//  a mini polyline of the asset's most recent active day, next
//  to the position metadata.
//
//  Dimensioning is controlled by the parent's CSS (e.g.
//  page.module.css). The inner AssetMiniMap honors the parent
//  height through `100% / min-height` rules.
// ═══════════════════════════════════════════════════════════════

const Inner = dynamic(() => import("./AssetMiniMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.empty}>
      <span>Cargando mapa…</span>
    </div>
  ),
});

interface AssetRouteMapProps {
  points: {
    lat: number;
    lng: number;
    speedKmh: number;
    ignition: boolean;
    recordedAt: Date;
  }[];
  fallbackCenter?: { lat: number; lng: number };
  lastHeading?: number;
}

export function AssetRouteMap(props: AssetRouteMapProps) {
  return <Inner {...props} />;
}
