"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { TripRoute, TripRow } from "@/lib/queries/trips";
import { buildHistoricosHref } from "@/lib/url-historicos";
import { TripsTable } from "@/components/maxtracker/TripsTable";
import {
  MapLayerToggle,
  type MapLayer,
} from "@/components/maxtracker/MapLayerToggle";
import type { TripsParams } from "@/lib/url-trips";
import styles from "./TripsClient.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsClient · joins TripsTable and TripsRoutesMap with shared
//  hover state. Map has a layer toggle. Click on a trip
//  (table row arrow OR map polyline) → navigate to Históricos.
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

interface TripsClientProps {
  trips: TripRow[];
  routes: TripRoute[];
  sortParams: TripsParams;
}

export function TripsClient({ trips, routes, sortParams }: TripsClientProps) {
  const router = useRouter();
  const [highlightedTripId, setHighlightedTripId] = useState<string | null>(
    null,
  );

  // Persist layer choice across reloads (matches FleetTrackingClient)
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

  function handleClickRoute(route: TripRoute) {
    const trip = trips.find((t) => t.id === route.tripId);
    if (!trip) return;
    const date = ymd(trip.startedAt);
    // F2: pasar HH:MM del viaje · misma lógica que TripsTable.
    const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
    const hhmm = (d: Date) => {
      const local = new Date(d.getTime() - AR_OFFSET_MS);
      return `${String(local.getUTCHours()).padStart(2, "0")}:${String(
        local.getUTCMinutes(),
      ).padStart(2, "0")}`;
    };
    const fromTime = hhmm(trip.startedAt);
    const toTime = hhmm(trip.endedAt);
    router.push(
      buildHistoricosHref(
        { assetId: null, date: null, fromTime: null, toTime: null },
        {
          assetId: trip.assetId,
          date,
          fromTime,
          toTime: fromTime < toTime ? toTime : null,
        },
      ),
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mapColumn}>
        <div className={styles.mapWrap}>
          <TripsRoutesMap
            routes={routes}
            highlightedTripId={highlightedTripId}
            onHoverTrip={setHighlightedTripId}
            onClickTrip={handleClickRoute}
            layer={mapLayer}
          />
          <div className={styles.mapControls}>
            <MapLayerToggle
              value={mapLayer}
              onChange={handleLayerChange}
            />
          </div>
        </div>
      </div>
      <div className={styles.tableColumn}>
        <TripsTable
          trips={trips}
          highlightedTripId={highlightedTripId}
          onHoverTrip={setHighlightedTripId}
          sortParams={sortParams}
        />
      </div>
    </div>
  );
}

function ymd(date: Date): string {
  const localMs = date.getTime() - 3 * 60 * 60 * 1000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
