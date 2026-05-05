// @ts-nocheck · pre-existing patterns (leaflet sin types)
"use client";

import { useEffect, useRef } from "react";
import styles from "./InfractionPrintMap.module.css";

// ═══════════════════════════════════════════════════════════════
//  InfractionPrintMap · S4-L3d
//  ─────────────────────────────────────────────────────────────
//  Mapa estático Leaflet pensado para el recibo PDF imprimible.
//  Diferencias vs el mapa del side panel:
//    · Tamaño grande, fijo (medido en mm para A4)
//    · Sin controles de zoom (zoom calculado para fit-bounds)
//    · Sin interacción (drag/scroll/click deshabilitados)
//    · Polilínea más gruesa para que se vea en impresión
//
//  Limitación · las tiles cargan async. Si el usuario hace
//  Cmd+P inmediatamente al abrir la página, puede que el mapa
//  no se haya pintado completo. Workaround · esperar que cargue
//  visualmente antes de imprimir. Soluciones más sofisticadas
//  (server-rendered tiles, capture API) quedan post-MVP.
// ═══════════════════════════════════════════════════════════════

interface Props {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  trackJson: string;
  color: string;
}

export function InfractionPrintMap(props: Props) {
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
      }).setView([props.startLat, props.startLon], 14);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        { subdomains: "abcd", maxZoom: 19 },
      ).addTo(map);

      // Reconstruir polilínea desde trackJson
      let polyline: [number, number][] = [];
      try {
        const samples = JSON.parse(props.trackJson) as Array<
          [number, number, string, number]
        >;
        polyline = samples.map((s) => [s[0], s[1]]);
      } catch {
        polyline = [
          [props.startLat, props.startLon],
          [props.endLat, props.endLon],
        ];
      }

      if (polyline.length >= 2) {
        const line = L.polyline(polyline, {
          color: props.color,
          weight: 5, // más gruesa que en panel · 4 → 5 para print
          opacity: 0.9,
        }).addTo(map);

        L.circleMarker([props.startLat, props.startLon], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: 1,
        })
          .bindTooltip("Inicio", { permanent: false })
          .addTo(map);

        L.circleMarker([props.endLat, props.endLon], {
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
        L.circleMarker([props.startLat, props.startLon], {
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
  }, [props.startLat, props.startLon, props.endLat, props.endLon, props.trackJson, props.color]);

  return <div ref={containerRef} className={styles.map} />;
}
