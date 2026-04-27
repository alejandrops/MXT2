"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LeafletMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  LeafletMapInner — dynamically imported by LeafletMap.tsx
//  ─────────────────────────────────────────────────────────────
//  Why a separate file:
//    · Leaflet uses `window` and breaks during SSR
//    · We `dynamic(() => import("./LeafletMapInner"), { ssr:false })`
//      from LeafletMap.tsx so this code only runs in the browser
//
//  Marker icons:
//    react-leaflet's default marker icons fail in Next.js because
//    of how webpack handles asset imports inside leaflet's npm
//    package. We supply explicit URLs from the public CDN.
// ═══════════════════════════════════════════════════════════════

// Configure default marker icons once
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LeafletMapInnerProps {
  lat: number;
  lng: number;
  zoom?: number;
  popupContent?: React.ReactNode;
}

export function LeafletMapInner({
  lat,
  lng,
  zoom = 13,
  popupContent,
}: LeafletMapInnerProps) {
  return (
    <div className={styles.mapWrap}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        className={styles.map}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={customIcon}>
          {popupContent && <Popup>{popupContent}</Popup>}
        </Marker>
        <ResizeOnMount />
      </MapContainer>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  ResizeOnMount
//  ─────────────────────────────────────────────────────────────
//  Per project memory: Leaflet inside flex containers needs an
//  explicit invalidateSize() call AFTER the container is sized,
//  with a small delay to let the DOM settle. Otherwise tiles
//  render at 0×0 until the user interacts.
// ───────────────────────────────────────────────────────────────

function ResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    // Two-phase wait: rAF for the next paint, then a 300ms timer
    // to cover slow layout reflows.
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(() => map.invalidateSize(true), 300);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, [map]);
  return null;
}
