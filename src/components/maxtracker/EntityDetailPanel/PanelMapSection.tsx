// @ts-nocheck · pre-existing patterns (leaflet sin types)
"use client";

import { useEffect, useRef } from "react";
import styles from "./EntityDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  PanelMapSection · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Mini-mapa Leaflet con tres modos:
//
//    1. PIN puntual           · solo lat/lng, marker simple
//    2. POLILÍNEA              · trackJson con array de puntos
//    3. SEGMENTO inicio→fin   · startLat/startLng + endLat/endLng
//                                con colores diferenciados
//
//  Sin controles · no-interactivo (es para mostrar contexto, no
//  para explorar). Ajusta zoom automático con fitBounds.
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** Modo PIN · solo lat/lng */
  lat?: number | null;
  lng?: number | null;
  /** Modo SEGMENTO · 4 coords */
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  /** Modo POLILÍNEA · JSON array de [lat, lng, ...] */
  trackJson?: string | null;
  /** Color del trazo · default azul Maxtracker */
  color?: string;
  /** Altura · default 220px (corto) · usar 280px para más detalle */
  height?: number;
  /** Título opcional sobre el mapa · ej. "Recorrido" */
  title?: string;
}

export function PanelMapSection({
  lat,
  lng,
  startLat,
  startLng,
  endLat,
  endLng,
  trackJson,
  color = "#2563EB",
  height = 220,
  title,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      // Cleanup mapa anterior
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Center inicial · primer punto disponible
      const center =
        startLat != null && startLng != null
          ? [startLat, startLng]
          : lat != null && lng != null
            ? [lat, lng]
            : [-34.6, -58.4]; // Buenos Aires fallback

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
      }).setView(center, 14);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);

      // Decidir qué dibujar
      let polyline: [number, number][] = [];
      if (trackJson) {
        try {
          const samples = JSON.parse(trackJson) as Array<[number, number, ...unknown[]]>;
          polyline = samples.map((s) => [s[0], s[1]]);
        } catch {
          /* fallback a segmento o pin */
        }
      }

      if (polyline.length === 0 && startLat != null && startLng != null && endLat != null && endLng != null) {
        polyline = [
          [startLat, startLng],
          [endLat, endLng],
        ];
      }

      if (polyline.length >= 2) {
        // Modo POLILÍNEA o SEGMENTO
        const line = L.polyline(polyline, {
          color,
          weight: 4,
          opacity: 0.85,
        }).addTo(map);

        // Marcadores inicio (verde) y fin (rojo) si tenemos esos campos
        if (startLat != null && startLng != null) {
          L.circleMarker([startLat, startLng], {
            radius: 6,
            color: "#fff",
            weight: 2,
            fillColor: "#22c55e",
            fillOpacity: 1,
          }).addTo(map);
        }
        if (endLat != null && endLng != null) {
          L.circleMarker([endLat, endLng], {
            radius: 6,
            color: "#fff",
            weight: 2,
            fillColor: "#dc2626",
            fillOpacity: 1,
          }).addTo(map);
        }

        map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 16 });
      } else if (lat != null && lng != null) {
        // Modo PIN
        L.circleMarker([lat, lng], {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map);
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, startLat, startLng, endLat, endLng, trackJson, color]);

  return (
    <section className={styles.section}>
      {title && <div className={styles.sectionTitle}>{title}</div>}
      <div
        ref={containerRef}
        className={styles.mapWrap}
        style={{ height: `${height}px` }}
      />
    </section>
  );
}
