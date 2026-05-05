// @ts-nocheck · pre-existing patterns (Prisma types stale, leaflet.heat sin types)
"use client";

import { useEffect, useRef, useState } from "react";
import type { InfractionHeatPoint } from "@/lib/queries/infractions-list";
import styles from "./InfractionHeatmap.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionHeatmap · S4-L3c
//  ─────────────────────────────────────────────────────────────
//  Heatmap de infracciones de velocidad. Clonado del EventHeatmap
//  pero adaptado al shape de InfractionHeatPoint (severity LEVE
//  / MEDIA / GRAVE en lugar de LOW/MED/HIGH/CRITICAL · y un
//  solo "tipo" implícito · speeding).
//
//  Toggle interno · Heatmap denso vs Pins individuales.
//  Pins: color por severity · ámbar suave (LEVE), ámbar fuerte
//  (MEDIA), rojo (GRAVE).
// ═══════════════════════════════════════════════════════════════

interface Props {
  points: InfractionHeatPoint[];
  /** Altura en px · default 600 */
  height?: number;
}

type ViewMode = "heatmap" | "pins";

const SEVERITY_COLORS: Record<"LEVE" | "MEDIA" | "GRAVE", string> = {
  LEVE: "#f59e0b",
  MEDIA: "#ea580c",
  GRAVE: "#dc2626",
};

const SEVERITY_LABELS: Record<"LEVE" | "MEDIA" | "GRAVE", string> = {
  LEVE: "Leve",
  MEDIA: "Media",
  GRAVE: "Grave",
};

function severityToIntensity(s: "LEVE" | "MEDIA" | "GRAVE"): number {
  switch (s) {
    case "GRAVE":
      return 1.0;
    case "MEDIA":
      return 0.65;
    case "LEVE":
      return 0.35;
    default:
      return 0.5;
  }
}

export function InfractionHeatmap({ points, height = 600 }: Props) {
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
            0.3: "#f59e0b", // ámbar
            0.6: "#ea580c", // ámbar fuerte
            1.0: "#dc2626", // rojo
          },
        });
        heat.addTo(map);
        heatLayerRef.current = heat;
      } else {
        // Pins individuales · color por severity
        const layer = L.layerGroup();
        for (const p of points) {
          const color = SEVERITY_COLORS[p.severity];
          const marker = L.circleMarker([p.lat, p.lng], {
            radius: p.severity === "GRAVE" ? 6 : 5,
            color: "#fff",
            weight: 1,
            fillColor: color,
            fillOpacity: 0.85,
          });
          marker.bindTooltip(`${SEVERITY_LABELS[p.severity]}`, {
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
          {points.length === 1 ? "infracción" : "infracciones"}
        </div>
      </div>

      <div ref={containerRef} className={styles.mapContainer} />

      {points.length === 0 && (
        <div className={styles.empty}>
          <p>No hay infracciones georeferenciadas para los filtros aplicados.</p>
        </div>
      )}
    </div>
  );
}
