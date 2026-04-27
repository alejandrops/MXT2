"use client";

import { useEffect, useRef } from "react";
import styles from "./AssetMiniMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetMiniMap · standalone day-route map
//  ─────────────────────────────────────────────────────────────
//  Renders a small Leaflet map showing:
//    · the polyline of the day's route (cyan, matches v8/heatmap)
//    · the start point (blue dot) and end point (cyan dot with
//      arrow/heading)
//
//  Self-contained · no scrubber, no events, no playback. Just
//  "where the vehicle was today / on the most recent active day".
//  Pairs with the day-stats panel to give a fast visual answer
//  to "what did this vehicle do today?".
// ═══════════════════════════════════════════════════════════════

interface AssetMiniMapProps {
  points: {
    lat: number;
    lng: number;
    speedKmh: number;
    ignition: boolean;
    recordedAt: Date;
  }[];
  /** Used to seed the empty-state center if no points */
  fallbackCenter?: { lat: number; lng: number };
  lastHeading?: number;
}

export default function AssetMiniMap({
  points,
  fallbackCenter,
  lastHeading = 0,
}: AssetMiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // ── Init map once ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // Inject leaflet CSS via CDN if not already present
      const cssId = "leaflet-css";
      if (!document.getElementById(cssId)) {
        const link = document.createElement("link");
        link.id = cssId;
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (cancelled || !containerRef.current) return;

      LRef.current = L;
      const center =
        points.length > 0
          ? [points[0]!.lat, points[0]!.lng]
          : fallbackCenter
            ? [fallbackCenter.lat, fallbackCenter.lng]
            : [-34.6037, -58.3816]; // Buenos Aires fallback

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center as [number, number], 13);
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        },
      ).addTo(map);

      // Fix sizing for flex containers
      requestAnimationFrame(() => {
        setTimeout(() => map.invalidateSize(true), 300);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update polyline + markers when points change ──────
  useEffect(() => {
    if (!mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    // Clean previous overlays
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    if (points.length < 2) {
      // Single or no point · just place a marker if we have one
      if (points.length === 1) {
        const p = points[0]!;
        endMarkerRef.current = L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color: "#0891B2",
          weight: 2,
          fillColor: "#0891B2",
          fillOpacity: 0.9,
        }).addTo(map);
        map.setView([p.lat, p.lng], 14);
      }
      return;
    }

    const latlngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    polylineRef.current = L.polyline(latlngs, {
      color: "#0891B2",
      weight: 3,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    const start = points[0]!;
    const end = points[points.length - 1]!;

    startMarkerRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 5,
      color: "#1d4ed8",
      weight: 2,
      fillColor: "#fff",
      fillOpacity: 1,
    })
      .bindTooltip(`Inicio · ${formatTime(start.recordedAt)}`, {
        direction: "top",
      })
      .addTo(map);

    endMarkerRef.current = L.circleMarker([end.lat, end.lng], {
      radius: 7,
      color: "#0891B2",
      weight: 2,
      fillColor: "#0891B2",
      fillOpacity: 0.9,
    })
      .bindTooltip(`Última posición · ${formatTime(end.recordedAt)}`, {
        direction: "top",
      })
      .addTo(map);

    // Fit to route bounds
    const bounds = polylineRef.current.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }
  }, [points, lastHeading]);

  if (points.length === 0 && !fallbackCenter) {
    return (
      <div className={styles.empty}>
        Este vehículo no tiene posiciones recientes.
      </div>
    );
  }

  return <div ref={containerRef} className={styles.map} />;
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
