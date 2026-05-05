// @ts-nocheck · pre-existing patterns
import Link from "next/link";
import { listTripsAndStopsByDay } from "@/lib/queries/trips-by-day";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import type { ObjectType } from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { EmptyState } from "@/components/maxtracker/ui";
import { ChevronRight, MapPin } from "lucide-react";
import styles from "./ViajesBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  ViajesBookTab · S4-L1
//  ─────────────────────────────────────────────────────────────
//  Listado de viajes del objeto en el período seleccionado.
//
//  · vehiculo  · trips de este asset
//  · conductor · trips manejados por este person
//  · grupo     · trips de los assets del grupo
//
//  Filtra solo items kind="trip" (sin paradas) · las paradas
//  tienen su propio tab.
//
//  Reusa listTripsAndStopsByDay · misma query que /actividad/viajes
//  pero con scope al objeto. La query ya soporta filtro por
//  assetIds, personIds y groupIds.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

export async function ViajesBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  // Resolver rango de fechas según granularidad/anchor
  const { fromDate, toDate } = computeDateRange(granularity, anchorIso);

  // Filtros según tipo
  const filters = {
    fromDate,
    toDate,
    accountId,
    ...(type === "vehiculo" && { assetIds: [id] }),
    ...(type === "conductor" && { personIds: [id] }),
    ...(type === "grupo" && { groupIds: [id] }),
  };

  const days = await listTripsAndStopsByDay(filters);

  // Filtrar solo items kind=trip
  const daysWithTrips = days
    .map((day) => ({
      ...day,
      items: day.items.filter((it) => it.kind === "trip"),
    }))
    .filter((day) => day.items.length > 0);

  if (daysWithTrips.length === 0) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Sin viajes en este período"
          description={`No se registraron viajes ${formatRangeLabel(fromDate, toDate)}.`}
        />
      </div>
    );
  }

  // Resumen header
  const totalTrips = daysWithTrips.reduce(
    (acc, d) => acc + d.items.length,
    0,
  );
  const totalDistance = daysWithTrips.reduce(
    (acc, d) =>
      acc +
      d.items.reduce(
        (a, it) => a + (it.kind === "trip" ? it.distanceKm : 0),
        0,
      ),
    0,
  );
  const totalDuration = daysWithTrips.reduce(
    (acc, d) =>
      acc +
      d.items.reduce(
        (a, it) => a + (it.kind === "trip" ? it.durationMs : 0),
        0,
      ),
    0,
  );

  return (
    <div className={styles.wrap}>
      {/* KPIs del período */}
      <div className={styles.kpiStrip}>
        <Kpi label="Viajes" value={totalTrips.toString()} />
        <Kpi
          label="Distancia"
          value={`${totalDistance.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`}
        />
        <Kpi label="Tiempo en marcha" value={formatDuration(totalDuration)} />
        <Kpi
          label="Días con actividad"
          value={daysWithTrips.length.toString()}
        />
      </div>

      {/* Listado por día */}
      <div className={styles.daysList}>
        {daysWithTrips.map((day) => (
          <DayCard key={day.id} day={day} type={type} />
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
    </div>
  );
}

function DayCard({ day, type }: { day: any; type: ObjectType }) {
  const dayDate = new Date(day.dayIso + "T00:00:00Z");
  const dayLabel = dayDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className={styles.dayCard}>
      <div className={styles.dayHeader}>
        <div className={styles.dayDate}>{dayLabel}</div>
        <div className={styles.dayMeta}>
          {/* Mostrar asset y/o driver según tipo */}
          {type !== "vehiculo" && (
            <span className={styles.metaItem}>
              {day.assetName} · {day.assetPlate ?? "—"}
            </span>
          )}
          {type !== "conductor" && day.driverName && (
            <span className={styles.metaItem}>{day.driverName}</span>
          )}
          <span className={styles.metaSep}>·</span>
          <span>
            {day.items.length} {day.items.length === 1 ? "viaje" : "viajes"}
          </span>
        </div>
      </div>
      <div className={styles.tripsList}>
        {day.items.map((trip: any) => (
          <TripRow key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
}

function TripRow({ trip }: { trip: any }) {
  const startTime = new Date(trip.startedAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const endTime = new Date(trip.endedAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <div className={styles.tripRow}>
      <div className={styles.tripTime}>
        {startTime} → {endTime}
      </div>
      <div className={styles.tripStats}>
        <span>{trip.distanceKm.toFixed(1)} km</span>
        <span>{formatDuration(trip.durationMs)}</span>
        <span>máx {Math.round(trip.maxSpeedKmh)} km/h</span>
        {trip.eventCount > 0 && (
          <span
            className={
              trip.highSeverityEventCount > 0
                ? styles.eventBadgeHigh
                : styles.eventBadge
            }
          >
            {trip.eventCount} {trip.eventCount === 1 ? "evento" : "eventos"}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function computeDateRange(
  granularity: AnalysisGranularity,
  anchorIso: string,
): { fromDate: string; toDate: string } {
  const anchor = new Date(anchorIso + "T12:00:00-03:00");
  let from: Date;
  let to: Date;

  switch (granularity) {
    case "day-hours": {
      from = new Date(anchor);
      to = new Date(anchor);
      break;
    }
    case "week-days": {
      // Lunes de la semana del anchor a domingo
      const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
      from = new Date(anchor.getTime() - dow * 86400000);
      to = new Date(from.getTime() + 6 * 86400000);
      break;
    }
    case "month-days": {
      from = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
      );
      to = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
      );
      break;
    }
    case "year-weeks":
    case "year-months": {
      from = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
      to = new Date(Date.UTC(anchor.getUTCFullYear(), 11, 31));
      break;
    }
  }

  const isoFrom = from.toISOString().slice(0, 10);
  const isoTo = to.toISOString().slice(0, 10);
  return { fromDate: isoFrom, toDate: isoTo };
}

function formatRangeLabel(fromDate: string, toDate: string): string {
  if (fromDate === toDate) return `el ${fromDate}`;
  return `entre ${fromDate} y ${toDate}`;
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
