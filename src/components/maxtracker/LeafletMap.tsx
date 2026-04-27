"use client";

import dynamic from "next/dynamic";
import styles from "./LeafletMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  LeafletMap — public Client wrapper
//  ─────────────────────────────────────────────────────────────
//  Lazy-loads the actual Leaflet renderer with ssr:false so the
//  server build never tries to evaluate leaflet code (which
//  references `window`).
// ═══════════════════════════════════════════════════════════════

const Inner = dynamic(
  () =>
    import("./LeafletMapInner").then((m) => ({ default: m.LeafletMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <span>Cargando mapa…</span>
      </div>
    ),
  },
);

interface LeafletMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  popupContent?: React.ReactNode;
}

export function LeafletMap(props: LeafletMapProps) {
  return <Inner {...props} />;
}
