// @ts-nocheck · pre-existing patterns
import { listTripsAndStopsByDay } from "@/lib/queries/trips-by-day";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import type { ObjectType } from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { EmptyState } from "@/components/maxtracker/ui";
import { MapPin } from "lucide-react";
import styles from "./ParadasBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  ParadasBookTab · S4-L1
//  ─────────────────────────────────────────────────────────────
//  Listado de paradas del objeto. Las paradas se derivan de los
//  gaps entre trips consecutivos · NO existe modelo Stop en DB.
//
//  Solo items kind="stop" del listTripsAndStopsByDay.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

export async function ParadasBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  const { fromDate, toDate } = computeDateRange(granularity, anchorIso);

  const filters = {
    fromDate,
    toDate,
    accountId,
    ...(type === "vehiculo" && { assetIds: [id] }),
    ...(type === "conductor" && { personIds: [id] }),
    ...(type === "grupo" && { groupIds: [id] }),
  };

  const days = await listTripsAndStopsByDay(filters);

  // Filtrar solo items kind=stop
  const daysWithStops = days
    .map((day) => ({
      ...day,
      items: day.items.filter((it) => it.kind === "stop"),
    }))
    .filter((day) => day.items.length > 0);

  if (daysWithStops.length === 0) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Sin paradas en este período"
          description={`No se registraron paradas ${formatRangeLabel(fromDate, toDate)}.`}
        />
      </div>
    );
  }

  // KPIs
  const totalStops = daysWithStops.reduce(
    (acc, d) => acc + d.items.length,
    0,
  );
  const totalDuration = daysWithStops.reduce(
    (acc, d) => acc + d.items.reduce((a, it) => a + it.durationMs, 0),
    0,
  );
  const longStops = daysWithStops.reduce(
    (acc, d) => acc + d.items.filter((it: any) => it.isLong).length,
    0,
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.kpiStrip}>
        <Kpi label="Paradas" value={totalStops.toString()} />
        <Kpi
          label="Tiempo detenido"
          value={formatDuration(totalDuration)}
        />
        <Kpi label="Paradas largas (>1h)" value={longStops.toString()} />
        <Kpi
          label="Días con actividad"
          value={daysWithStops.length.toString()}
        />
      </div>

      <div className={styles.daysList}>
        {daysWithStops.map((day) => (
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
          {type !== "vehiculo" && (
            <span>
              {day.assetName} · {day.assetPlate ?? "—"}
            </span>
          )}
          {type !== "conductor" && day.driverName && (
            <span>{day.driverName}</span>
          )}
          <span className={styles.metaSep}>·</span>
          <span>
            {day.items.length}{" "}
            {day.items.length === 1 ? "parada" : "paradas"}
          </span>
        </div>
      </div>
      <div className={styles.stopsList}>
        {day.items.map((stop: any) => (
          <StopRow key={stop.id} stop={stop} />
        ))}
      </div>
    </div>
  );
}

function StopRow({ stop }: { stop: any }) {
  const startTime = new Date(stop.startedAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const endTime = new Date(stop.endedAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <div className={styles.stopRow}>
      <MapPin size={14} className={styles.stopIcon} />
      <div className={styles.stopTime}>
        {startTime} → {endTime}
      </div>
      <div className={styles.stopDuration}>
        {formatDuration(stop.durationMs)}
        {stop.isLong && (
          <span className={styles.longBadge}>parada larga</span>
        )}
      </div>
      <div className={styles.stopCoords}>
        {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
      </div>
    </div>
  );
}

// Helpers · idénticos a ViajesBookTab (duplicados a propósito · evita acoplamiento)

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

  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
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
