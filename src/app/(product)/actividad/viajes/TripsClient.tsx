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
//  TripsClient · vista B1 · tabla 60% + mapa/panel 40%
//  ─────────────────────────────────────────────────────────────
//  Click en fila de la tabla → setSelectedDayId → el mapa se
//  reemplaza por el TripDetailPanel con timeline cronológica.
//  En el panel, click en un trip de la timeline → setSelectedItemId
//  → el item se highlightea (seguirá al mapa cuando se cierre el
//  panel, vía highlightedTripId).
//
//  Layout:
//   - Sin selección: lista | mapa con todas las rutas
//   - Con día seleccionado: lista | panel con timeline + detalle
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
  capStep: number;
}

export function TripsClient({ days, totalDays, currentCap, capStep }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
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
    const nextCap = currentCap + capStep;
    const params = new URLSearchParams(searchParams.toString());
    params.set("cap", String(nextCap));
    router.push(`/actividad/viajes?${params.toString()}`);
  }

  // El día seleccionado (si existe)
  const selectedDay = useMemo(() => {
    if (!selectedDayId) return null;
    return days.find((d) => d.id === selectedDayId) ?? null;
  }, [selectedDayId, days]);

  // Construir las "rutas" para el mapa · una entrada por trip
  const routes = useMemo(() => {
    const list: {
      tripId: string;
      assetId: string;
      assetName: string;
      points: { lat: number; lng: number }[];
    }[] = [];
    for (const day of days) {
      for (const item of day.items) {
        if (item.kind === "trip") {
          list.push({
            tripId: item.id,
            assetId: day.assetId,
            assetName: day.assetName,
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

  const showCapBanner = totalDays > days.length;
  const remaining = totalDays - days.length;

  return (
    <div className={styles.layout}>
      {/* ── Tabla (protagonista · 60%) ────────────────────────── */}
      <div className={styles.listColumn}>
        {showCapBanner && (
          <div className={styles.capBanner}>
            <span className={styles.capLabel}>
              Viendo {days.length} de {totalDays} filas
            </span>
            <span className={styles.capHint}>
              · refiná filtros para ver lo que te interesa
            </span>
            <button
              type="button"
              className={styles.capButton}
              onClick={loadMore}
            >
              Ver {Math.min(capStep, remaining)} más
            </button>
          </div>
        )}
        <DaysList
          days={days}
          selectedDayId={selectedDayId}
          onSelectDay={(id) => {
            setSelectedDayId(id);
            setSelectedItemId(null);
          }}
        />
      </div>

      {/* ── Mapa o Panel detalle (subordinado · 40%) ──────────── */}
      <div className={styles.mapColumn}>
        {selectedDay ? (
          <TripDetailPanel
            day={selectedDay}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onClose={() => {
              setSelectedDayId(null);
              setSelectedItemId(null);
            }}
          />
        ) : (
          <div className={styles.mapWrap}>
            <TripsRoutesMap
              routes={routes}
              highlightedTripId={null}
              onHoverTrip={() => {}}
              onClickTrip={(route) => {
                // Buscar el día al que pertenece el trip y seleccionarlo
                for (const day of days) {
                  const item = day.items.find((i) => i.id === route.tripId);
                  if (item) {
                    setSelectedDayId(day.id);
                    setSelectedItemId(item.id);
                    return;
                  }
                }
              }}
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
