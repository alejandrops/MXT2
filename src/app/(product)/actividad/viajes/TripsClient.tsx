"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Day } from "@/lib/queries/trips-by-day";
import {
  MapLayerToggle,
  type MapLayer,
} from "@/components/maxtracker/MapLayerToggle";
import { DaysList } from "./DaysList";
import { TripDetailPanel } from "./TripDetailPanel";
import styles from "./TripsClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsClient · vista "Día por día" del rework de Viajes
//  ─────────────────────────────────────────────────────────────
//  Layout invertido · listado protagonista a la izquierda (60%),
//  mapa subordinado a la derecha (40%).
//
//  Selección por click · NO hover. Click en un item del listado:
//    1. Resalta la polyline en el mapa (los demás se oscurecen)
//    2. Abre el TripDetailPanel sobre el mapa
//
//  CAP · cuando totalDays > days.length, mostramos un banner con
//  "Viendo 20 de 161" + botón "Ver más" que actualiza ?cap= en
//  la URL · suma 20 cada click.
// ═══════════════════════════════════════════════════════════════

const TripsRoutesMap = dynamic(
  () =>
    import("@/components/maxtracker/TripsRoutesMap").then(
      (m) => m.TripsRoutesMap,
    ),
  {
    ssr: false,
    loading: () => <div className={styles.mapLoading}>Cargando mapa…</div>,
  },
);

interface Props {
  days: Day[];
  totalDays: number;
  currentCap: number;
}

const CAP_STEP = 20;

export function TripsClient({ days, totalDays, currentCap }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>(() => {
    if (typeof window === "undefined") return "BW";
    const saved = window.localStorage.getItem("trips-map-layer");
    if (saved === "STANDARD" || saved === "BW" || saved === "SATELLITE") {
      return saved;
    }
    return "BW";
  });

  function handleLayerChange(next: MapLayer) {
    setMapLayer(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("trips-map-layer", next);
    }
  }

  function loadMore() {
    const nextCap = currentCap + CAP_STEP;
    const params = new URLSearchParams(searchParams.toString());
    params.set("cap", String(nextCap));
    router.push(`/actividad/viajes?${params.toString()}`);
  }

  // Encontrar el día y el item seleccionado
  const selection = useMemo(() => {
    if (!selectedItemId) return null;
    for (const day of days) {
      const item = day.items.find((i) => i.id === selectedItemId);
      if (item) return { day, item };
    }
    return null;
  }, [selectedItemId, days]);

  // Construir las "rutas" para el mapa
  const routes = useMemo(() => {
    const list: {
      tripId: string;
      assetId: string;
      points: { lat: number; lng: number }[];
    }[] = [];
    for (const day of days) {
      for (const item of day.items) {
        if (item.kind === "trip") {
          list.push({
            tripId: item.id,
            assetId: day.assetId,
            points: [
              { lat: item.startLat, lng: item.startLng },
              { lat: item.endLat, lng: item.endLng },
            ],
          });
        }
      }
    }
    return list;
  }, [days]);

  const highlightedTripId =
    selection?.item.kind === "trip" ? selection.item.id : null;

  const showCapBanner = totalDays > days.length;

  return (
    <div className={styles.layout}>
      {/* ── Lista (protagonista · 60%) ────────────────────────── */}
      <div className={styles.listColumn}>
        {showCapBanner && (
          <div className={styles.capBanner}>
            <span className={styles.capLabel}>
              Viendo {days.length} de {totalDays} tarjetas
            </span>
            <span className={styles.capHint}>
              · refiná filtros para ver lo que te interesa
            </span>
            <button
              type="button"
              className={styles.capButton}
              onClick={loadMore}
            >
              Ver {Math.min(CAP_STEP, Math.max(0, (totalDays ?? 0) - (days?.length ?? 0)))} más
            </button>
          </div>
        )}
        <DaysList
          days={days}
          selectedItemId={selectedItemId}
          onSelectItem={(id) =>
            setSelectedItemId(id === selectedItemId ? null : id)
          }
        />
      </div>

      {/* ── Mapa + panel (subordinado · 40%) ──────────────────── */}
      <div className={styles.mapColumn}>
        {selection ? (
          <TripDetailPanel
            day={selection.day}
            item={selection.item}
            onClose={() => setSelectedItemId(null)}
          />
        ) : (
          <div className={styles.mapWrap}>
            <TripsRoutesMap
              routes={routes}
              highlightedTripId={highlightedTripId}
              onHoverTrip={() => {}}
              onClickTrip={(route) => setSelectedItemId(route.tripId)}
              layer={mapLayer}
            />
            <div className={styles.mapControls}>
              <MapLayerToggle
                value={mapLayer}
                onChange={handleLayerChange}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
