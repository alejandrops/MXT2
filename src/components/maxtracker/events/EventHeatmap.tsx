// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet.heat sin types)
"use client";

import { useEffect, useRef, useState } from "react";
import type { EventType, Severity } from "@/types/domain";
import { getEventColor, getEventLabel } from "@/lib/event-catalog";
import styles from "./EventHeatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventHeatmap · S4-L2 · componente reusable
//  ─────────────────────────────────────────────────────────────
//  Recibe puntos georeferenciados con tipo y severity y los pinta
//  como heatmap (default) o como pins coloreados por tipo.
//
//  Reusable en: /actividad/eventos, /conduccion/infracciones,
//  /seguridad/alarmas, etc · cualquier vista de eventos en el mapa.
//
//  Toggle interno · Heatmap denso vs Pins individuales.
//  Default zoom & center · ajusta a los puntos automáticamente.
// ═══════════════════════════════════════════════════════════════

export interface HeatPoint {
  lat: number;
  lng: number;
  type: EventType;
  severity: Severity;
}

interface Props {
  points: HeatPoint[];
  /** Altura en px · default 600 */
  height?: number;
}

type ViewMode = "heatmap" | "pins";

export function EventHeatmap({ points, height = 600 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const pinsLayerRef = useRef<any>(null);

  const [mode, setMode] = useState<ViewMode>("heatmap");
  const [ready, setReady] = useState(false);

  // Init Leaflet map
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // Side-effect import · agrega L.heatLayer al namespace
      await import("leaflet.heat");

      if (cancelled || !containerRef.current) return;

      // Default center · centro de Argentina si no hay puntos
      const initialCenter: [number, number] =
        points.length > 0
          ? [points[0]!.lat, points[0]!.lng]
          : [-34.6037, -58.3816]; // Buenos Aires

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(initialCenter, 11);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        {
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Re-render layers when points or mode change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.heat");
      if (cancelled || !mapRef.current) return;

      const map = mapRef.current;

      // Limpiar capas previas
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      if (pinsLayerRef.current) {
        map.removeLayer(pinsLayerRef.current);
        pinsLayerRef.current = null;
      }

      if (points.length === 0) return;

      if (mode === "heatmap") {
        // Heat data · [lat, lng, intensity]
        // Severity → intensidad
        const heatData = points.map((p) => [
          p.lat,
          p.lng,
          severityToIntensity(p.severity),
        ]);

        const heat = (L as any).heatLayer(heatData, {
          radius: 25,
          blur: 18,
          maxZoom: 15,
          gradient: {
            0.2: "#3b82f6",
            0.4: "#22c55e",
            0.6: "#eab308",
            0.8: "#f97316",
            1.0: "#dc2626",
          },
        });
        heat.addTo(map);
        heatLayerRef.current = heat;
      } else {
        // Pins individuales · color por tipo
        const layer = L.layerGroup();
        for (const p of points) {
          const color = getEventColor(p.type);
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: 5,
            color: "#fff",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.85,
          });
          marker.bindTooltip(getEventLabel(p.type), {
            direction: "top",
            offset: [0, -4],
          });
          marker.addTo(layer);
        }
        layer.addTo(map);
        pinsLayerRef.current = layer;
      }

      // Fit bounds a los puntos
      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, points, mode]);

  return (
    <div className={styles.wrap} style={{ height }}>
      {/* Controles flotantes */}
      <div className={styles.controls}>
        <div className={styles.toggle} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "heatmap"}
            onClick={() => setMode("heatmap")}
            className={`${styles.toggleBtn} ${mode === "heatmap" ? styles.toggleBtnActive : ""}`}
          >
            Heatmap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pins"}
            onClick={() => setMode("pins")}
            className={`${styles.toggleBtn} ${mode === "pins" ? styles.toggleBtnActive : ""}`}
          >
            Pins
          </button>
        </div>
        <div className={styles.count}>
          {points.length.toLocaleString("es-AR")}{" "}
          {points.length === 1 ? "evento" : "eventos"}
        </div>
      </div>

      <div ref={containerRef} className={styles.mapContainer} />

      {points.length === 0 && (
        <div className={styles.empty}>
          <p>No hay eventos georeferenciados para los filtros aplicados.</p>
        </div>
      )}
    </div>
  );
}

function severityToIntensity(s: Severity): number {
  switch (s) {
    case "CRITICAL":
      return 1.0;
    case "HIGH":
      return 0.75;
    case "MEDIUM":
      return 0.5;
    case "LOW":
      return 0.25;
    default:
      return 0.5;
  }
}
