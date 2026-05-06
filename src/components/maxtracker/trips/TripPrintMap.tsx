// @ts-nocheck · pre-existing patterns (leaflet sin types)
"use client";

import { useEffect, useRef } from "react";
import styles from "./TripPrintMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripPrintMap · S5-T4
//  ─────────────────────────────────────────────────────────────
//  Mapa estático para el recibo de viaje · clonado de
//  InfractionPrintMap (S4-L3d). Diferencias mínimas: usa
//  polylineJson en lugar de trackJson y end usa Lng (no Lon).
//
//  Mismas características:
//    · Sin controles · sin interacción
//    · fit-bounds automático con padding
//    · Polilínea gruesa para imprimir bien
//    · Inicio verde, fin rojo
// ═══════════════════════════════════════════════════════════════

interface Props {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  polylineJson: string;
  color: string;
}

export function TripPrintMap(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([props.startLat, props.startLng], 14);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);

      // Reconstruir polilínea desde polylineJson
      // Formato: [[lat, lng], ...] o [[lat, lng, ...extras], ...]
      let polyline: [number, number][] = [];
      try {
        const samples = JSON.parse(props.polylineJson) as Array<
          [number, number, ...unknown[]]
        >;
        polyline = samples.map((s) => [s[0], s[1]]);
      } catch {
        polyline = [
          [props.startLat, props.startLng],
          [props.endLat, props.endLng],
        ];
      }

      if (polyline.length >= 2) {
        const line = L.polyline(polyline, {
          color: props.color,
          weight: 5,
          opacity: 0.9,
        }).addTo(map);

        L.circleMarker([props.startLat, props.startLng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 1,
        })
          .bindTooltip("Inicio", { permanent: false })
          .addTo(map);

        L.circleMarker([props.endLat, props.endLng], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#dc2626",
          fillOpacity: 1,
        })
          .bindTooltip("Fin", { permanent: false })
          .addTo(map);

        map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 16 });
      } else {
        L.circleMarker([props.startLat, props.startLng], {
          radius: 9,
          color: "#fff",
          weight: 2,
          fillColor: props.color,
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
  }, [
    props.startLat,
    props.startLng,
    props.endLat,
    props.endLng,
    props.polylineJson,
    props.color,
  ]);

  return <div ref={containerRef} className={styles.map} />;
}
