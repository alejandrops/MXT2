// @ts-nocheck · pre-existing patterns
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import type { ObjectType } from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { EmptyState } from "@/components/maxtracker/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import styles from "./ResumenBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  ResumenBookTab · S4-L1
//  ─────────────────────────────────────────────────────────────
//  Vista tabular / numérica del período · KPIs agregados del
//  objeto + comparativa con sus pares.
//
//  · vehiculo  · KPIs propios + promedio del grupo + promedio flota
//  · conductor · KPIs propios + promedio de conductores del account
//  · grupo     · KPIs agregados del grupo + promedio entre grupos
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

interface Metrics {
  trips: number;
  distanceKm: number;
  durationMs: number;
  maxSpeedKmh: number;
  events: number;
  highSeverityEvents: number;
}

const ZERO_METRICS: Metrics = {
  trips: 0,
  distanceKm: 0,
  durationMs: 0,
  maxSpeedKmh: 0,
  events: 0,
  highSeverityEvents: 0,
};

export async function ResumenBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  const { startUtc, endUtc, prevStartUtc, prevEndUtc } = computePeriodRange(
    granularity,
    anchorIso,
  );

  // KPIs del objeto + del período anterior + del scope mayor (peers)
  const [own, prev, peers] = await Promise.all([
    fetchMetrics(type, id, accountId, startUtc, endUtc),
    fetchMetrics(type, id, accountId, prevStartUtc, prevEndUtc),
    fetchPeerAverage(type, id, accountId, startUtc, endUtc),
  ]);

  if (
    own.trips === 0 &&
    own.events === 0 &&
    own.distanceKm === 0
  ) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Sin actividad en este período"
          description="No se registraron viajes ni eventos para este objeto."
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.cards}>
        <MetricCard
          label="Viajes"
          value={own.trips.toLocaleString("es-AR")}
          previous={prev.trips}
          peerAvg={peers.trips}
          format={(n) => n.toLocaleString("es-AR")}
          peerLabel={peerLabelFor(type)}
        />
        <MetricCard
          label="Distancia"
          value={`${own.distanceKm.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`}
          previous={prev.distanceKm}
          peerAvg={peers.distanceKm}
          format={(n) =>
            `${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })} km`
          }
          peerLabel={peerLabelFor(type)}
        />
        <MetricCard
          label="Tiempo en marcha"
          value={formatDuration(own.durationMs)}
          previous={prev.durationMs}
          peerAvg={peers.durationMs}
          format={formatDuration}
          peerLabel={peerLabelFor(type)}
        />
        <MetricCard
          label="Velocidad máxima"
          value={`${Math.round(own.maxSpeedKmh)} km/h`}
          previous={prev.maxSpeedKmh}
          peerAvg={peers.maxSpeedKmh}
          format={(n) => `${Math.round(n)} km/h`}
          peerLabel={peerLabelFor(type)}
        />
        <MetricCard
          label="Eventos"
          value={own.events.toLocaleString("es-AR")}
          previous={prev.events}
          peerAvg={peers.events}
          format={(n) => n.toLocaleString("es-AR")}
          reverse
          peerLabel={peerLabelFor(type)}
        />
        <MetricCard
          label="Eventos críticos"
          value={own.highSeverityEvents.toLocaleString("es-AR")}
          previous={prev.highSeverityEvents}
          peerAvg={peers.highSeverityEvents}
          format={(n) => n.toLocaleString("es-AR")}
          reverse
          peerLabel={peerLabelFor(type)}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MetricCard · KPI con comparativa
// ═══════════════════════════════════════════════════════════════

interface MetricCardProps {
  label: string;
  value: string;
  previous: number;
  peerAvg: number;
  format: (n: number) => string;
  reverse?: boolean;
  peerLabel: string;
}

function MetricCard({
  label,
  value,
  previous,
  peerAvg,
  format,
  reverse,
  peerLabel,
}: MetricCardProps) {
  // Calcular delta vs período anterior
  const ownNum = parseFloat(value.replace(/[^\d.-]/g, "")) || 0;

  let trendIcon: typeof TrendingUp | null = null;
  let trendClass = "";
  let trendLabel = "";

  if (previous > 0) {
    const pct = ((ownNum - previous) / previous) * 100;
    if (Math.abs(pct) >= 2) {
      trendIcon = pct > 0 ? TrendingUp : TrendingDown;
      const isGood = reverse ? pct < 0 : pct > 0;
      trendClass = isGood ? styles.trendGood : styles.trendBad;
      trendLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
    } else {
      trendIcon = Minus;
      trendClass = styles.trendFlat;
      trendLabel = "≈";
    }
  }

  const TrendIcon = trendIcon;

  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{value}</div>
      <div className={styles.cardCompare}>
        {TrendIcon && (
          <span className={`${styles.trend} ${trendClass}`}>
            <TrendIcon size={12} />
            {trendLabel}
            <span className={styles.trendNote}>vs anterior</span>
          </span>
        )}
        {peerAvg > 0 && (
          <span className={styles.peer}>
            {peerLabel}: {format(peerAvg)}
          </span>
        )}
      </div>
    </div>
  );
}

function peerLabelFor(type: ObjectType): string {
  if (type === "vehiculo") return "Promedio flota";
  if (type === "conductor") return "Promedio conductores";
  return "Promedio grupos";
}

// ═══════════════════════════════════════════════════════════════
//  Queries
// ═══════════════════════════════════════════════════════════════

async function fetchMetrics(
  type: ObjectType,
  id: string,
  accountId: string | null,
  startUtc: Date,
  endUtc: Date,
): Promise<Metrics> {
  // Resolver assetIds según tipo
  const assetIds = await resolveAssetIds(type, id);
  if (assetIds.length === 0) return ZERO_METRICS;

  const tripWhere: any = {
    assetId: { in: assetIds },
    startedAt: { gte: startUtc, lte: endUtc },
  };
  if (type === "conductor") {
    tripWhere.personId = id;
  }

  const eventWhere: any = {
    assetId: { in: assetIds },
    occurredAt: { gte: startUtc, lte: endUtc },
  };
  if (type === "conductor") {
    eventWhere.personId = id;
  }

  const [tripAgg, eventCount, highEventCount] = await Promise.all([
    db.trip.aggregate({
      where: tripWhere,
      _count: { id: true },
      _sum: { distanceKm: true, durationMs: true },
      _max: { maxSpeedKmh: true },
    }),
    db.event.count({ where: eventWhere }),
    db.event.count({
      where: { ...eventWhere, severity: { in: ["HIGH", "CRITICAL"] } },
    }),
  ]);

  return {
    trips: tripAgg._count.id ?? 0,
    distanceKm: tripAgg._sum.distanceKm ?? 0,
    durationMs: tripAgg._sum.durationMs ?? 0,
    maxSpeedKmh: tripAgg._max.maxSpeedKmh ?? 0,
    events: eventCount,
    highSeverityEvents: highEventCount,
  };
}

async function fetchPeerAverage(
  type: ObjectType,
  id: string,
  accountId: string | null,
  startUtc: Date,
  endUtc: Date,
): Promise<Metrics> {
  // Para vehículo: promedio de TODOS los assets del account
  // Para conductor: promedio agregado por persona del account
  // Para grupo: promedio entre los grupos del account

  if (type === "vehiculo") {
    const where: any = { startedAt: { gte: startUtc, lte: endUtc } };
    if (accountId) where.asset = { accountId };

    const [tripAgg, assetCount] = await Promise.all([
      db.trip.aggregate({
        where,
        _count: { id: true },
        _sum: { distanceKm: true, durationMs: true },
        _max: { maxSpeedKmh: true },
      }),
      db.asset.count({
        where: {
          mobilityType: "MOBILE",
          ...(accountId ? { accountId } : {}),
        },
      }),
    ]);
    const eventWhere: any = { occurredAt: { gte: startUtc, lte: endUtc } };
    if (accountId) eventWhere.asset = { accountId };
    const [eventCount, highCount] = await Promise.all([
      db.event.count({ where: eventWhere }),
      db.event.count({
        where: { ...eventWhere, severity: { in: ["HIGH", "CRITICAL"] } },
      }),
    ]);

    const div = Math.max(assetCount, 1);
    return {
      trips: (tripAgg._count.id ?? 0) / div,
      distanceKm: (tripAgg._sum.distanceKm ?? 0) / div,
      durationMs: (tripAgg._sum.durationMs ?? 0) / div,
      maxSpeedKmh: tripAgg._max.maxSpeedKmh ?? 0,
      events: eventCount / div,
      highSeverityEvents: highCount / div,
    };
  }

  // Para conductor / grupo · cálculo similar pero scope distinto
  // Por simplicidad: usamos el mismo cálculo que vehículo pero
  // dividido por el conteo del tipo correspondiente.
  const where: any = { startedAt: { gte: startUtc, lte: endUtc } };
  if (accountId) where.asset = { accountId };

  const [tripAgg, divisor] = await Promise.all([
    db.trip.aggregate({
      where,
      _count: { id: true },
      _sum: { distanceKm: true, durationMs: true },
      _max: { maxSpeedKmh: true },
    }),
    type === "conductor"
      ? db.person.count({ where: accountId ? { accountId } : {} })
      : db.group.count({ where: accountId ? { accountId } : {} }),
  ]);

  const eventWhere: any = { occurredAt: { gte: startUtc, lte: endUtc } };
  if (accountId) eventWhere.asset = { accountId };
  const [eventCount, highCount] = await Promise.all([
    db.event.count({ where: eventWhere }),
    db.event.count({
      where: { ...eventWhere, severity: { in: ["HIGH", "CRITICAL"] } },
    }),
  ]);

  const div = Math.max(divisor, 1);
  return {
    trips: (tripAgg._count.id ?? 0) / div,
    distanceKm: (tripAgg._sum.distanceKm ?? 0) / div,
    durationMs: (tripAgg._sum.durationMs ?? 0) / div,
    maxSpeedKmh: tripAgg._max.maxSpeedKmh ?? 0,
    events: eventCount / div,
    highSeverityEvents: highCount / div,
  };
}

async function resolveAssetIds(
  type: ObjectType,
  id: string,
): Promise<string[]> {
  if (type === "vehiculo") return [id];
  if (type === "conductor") {
    // Asset que actualmente o históricamente manejó este conductor
    const trips = await db.trip.findMany({
      where: { personId: id },
      select: { assetId: true },
      distinct: ["assetId"],
    });
    return trips.map((t) => t.assetId);
  }
  if (type === "grupo") {
    const assets = await db.asset.findMany({
      where: { groupId: id },
      select: { id: true },
    });
    return assets.map((a) => a.id);
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function computePeriodRange(
  granularity: AnalysisGranularity,
  anchorIso: string,
) {
  const anchor = new Date(anchorIso + "T12:00:00-03:00");
  let start: Date;
  let end: Date;

  switch (granularity) {
    case "day-hours": {
      start = new Date(anchorIso + "T03:00:00.000Z"); // 00:00 AR
      end = new Date(start.getTime() + 86400000 - 1);
      break;
    }
    case "week-days": {
      const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
      start = new Date(anchor.getTime() - dow * 86400000);
      start.setUTCHours(3, 0, 0, 0);
      end = new Date(start.getTime() + 7 * 86400000 - 1);
      break;
    }
    case "month-days": {
      start = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 3),
      );
      end = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 3) - 1,
      );
      break;
    }
    case "year-weeks":
    case "year-months": {
      start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1, 3));
      end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1, 3) - 1);
      break;
    }
  }

  // Período anterior · misma duración
  const periodMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - periodMs);

  return {
    startUtc: start,
    endUtc: end,
    prevStartUtc: prevStart,
    prevEndUtc: prevEnd,
  };
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
