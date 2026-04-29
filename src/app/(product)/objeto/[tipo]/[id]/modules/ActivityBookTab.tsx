import { db } from "@/lib/db";
import { KpiCard, EmptyState } from "@/components/maxtracker/ui";
import type { AnalysisGranularity } from "@/lib/queries";
import type { ObjectType } from "@/lib/object-modules";
import { getAssetDayMapInRange } from "@/lib/queries/asset-day-map-in-range";
import { DayRouteCard } from "@/components/maxtracker/objeto/DayRouteCard";
import { DrivenAssetsSection } from "@/components/maxtracker/objeto/DrivenAssetsSection";
import { GroupCompositionSection } from "@/components/maxtracker/objeto/GroupCompositionSection";
import styles from "./ActivityBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  ActivityBookTab · módulo Actividad para el Libro · F2.B
//  ─────────────────────────────────────────────────────────────
//  Estructura · template estructural común a todos los modules:
//    0a. (vehiculo)  · DayRouteCard · ruta del último día con datos
//    0b. (conductor) · DrivenAssetsSection · vehículos asignados
//    0c. (grupo)     · GroupCompositionSection · vehículos + conductores
//    1. KPIs del período · 4 cards
//    2. Distribución temporal · barras por bucket de tiempo
//    3. Comparativa contra peers · vs flota y vs grupo (si aplica)
//    4. Lista cronológica · eventos relevantes (sin telemetría)
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

export async function ActivityBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const { fromDate, toDate, fromPrevDate, toPrevDate } = computeRange(
    granularity,
    anchorIso,
  );

  const [data, dataPrev, peerStats, ownGroupId, dayMap] = await Promise.all([
    loadActivityData(type, id, fromDate, toDate),
    loadActivityData(type, id, fromPrevDate, toPrevDate),
    loadPeerStats(type, id, fromDate, toDate),
    loadOwnGroupId(type, id),
    type === "vehiculo"
      ? getAssetDayMapInRange(id, granularity, anchorIso)
      : Promise.resolve(null),
  ]);

  if (!data) {
    return (
      <div className={styles.body}>
        <EmptyState
          title="Sin datos en el período"
          hint="Probá con un rango más amplio o cambiá la granularidad."
        />
      </div>
    );
  }

  const events = await loadEvents(type, id, fromDate, toDate);

  const deltaKm = computeDelta(data.distanceKm, dataPrev?.distanceKm ?? null);
  const deltaActive = computeDelta(
    data.activeMin,
    dataPrev?.activeMin ?? null,
  );
  const deltaTrips = computeDelta(data.tripCount, dataPrev?.tripCount ?? null);
  const deltaEvents = computeDelta(
    data.eventCount,
    dataPrev?.eventCount ?? null,
  );

  const deltaLabel = deltaLabelByGranularity(granularity);
  const trendTitle = trendTitleByGranularity(granularity);

  const groupPeer = ownGroupId
    ? peerStats.byGroup.find((g) => g.groupId === ownGroupId)
    : null;

  const showPeers =
    peerStats.fleet !== null &&
    (type === "vehiculo" || type === "conductor");

  return (
    <div className={styles.body}>
      {/* ── 0a. DayRouteCard (vehículos) ───────────────────── */}
      {dayMap && type === "vehiculo" && (
        <section>
          <DayRouteCard assetId={id} dayMap={dayMap} />
        </section>
      )}

      {/* ── 0b. Vehículos asignados (conductores) ──────────── */}
      {type === "conductor" && (
        <DrivenAssetsSection
          personId={id}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}

      {/* ── 0c. Composición del grupo (grupos) ─────────────── */}
      {type === "grupo" && (
        <GroupCompositionSection
          groupId={id}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}

      {/* ── 1. KPIs ────────────────────────────────────────── */}
      <section className={styles.kpiGrid}>
        <KpiCard
          size="md"
          label="Distancia"
          value={data.distanceKm.toLocaleString("es-AR", {
            maximumFractionDigits: 0,
          })}
          unit="km"
          delta={deltaKm}
          deltaLabel={deltaLabel}
        />
        <KpiCard
          size="md"
          label="Horas activas"
          value={fmtHours(data.activeMin)}
          unit="h"
          delta={deltaActive}
          deltaLabel={deltaLabel}
        />
        <KpiCard
          size="md"
          label="Viajes"
          value={data.tripCount.toLocaleString("es-AR")}
          delta={deltaTrips}
          deltaLabel={deltaLabel}
        />
        <KpiCard
          size="md"
          label="Eventos"
          value={data.eventCount.toLocaleString("es-AR")}
          delta={deltaEvents}
          deltaLabel={deltaLabel}
          isReverseDelta
        />
      </section>

      {/* ── 2. Distribución temporal ───────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{trendTitle}</h2>
        </header>
        {data.trend.length === 0 ? (
          <div className={styles.empty}>Sin datos</div>
        ) : (
          <TrendBars trend={data.trend} />
        )}
      </section>

      {/* ── 3. Comparativa contra peers ────────────────────── */}
      {showPeers && peerStats.fleet && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Comparativa contra peers</h2>
            <span className={styles.sectionHint}>
              {type === "vehiculo"
                ? `vs ${peerStats.fleet.count} vehículos en la flota`
                : `vs ${peerStats.fleet.count} conductores`}
            </span>
          </header>
          <PeerComparisons
            current={data}
            fleetAvg={peerStats.fleet.avg}
            groupAvg={groupPeer?.avg ?? null}
            groupName={groupPeer?.groupName ?? null}
            groupCount={groupPeer?.count ?? null}
          />
        </section>
      )}

      {/* ── 4. Eventos relevantes ──────────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Eventos relevantes · {events.length}
            {events.length === 50 ? "+" : ""}
          </h2>
          <span className={styles.sectionHint}>
            Excluye telemetría (ignición). Para detalle completo ir a
            Historial.
          </span>
        </header>
        {events.length === 0 ? (
          <EmptyState
            title="Sin eventos en el período"
            hint="No se registraron eventos para este objeto."
            size="compact"
          />
        ) : (
          <ul className={styles.eventList}>
            {events.map((e) => (
              <li key={e.id} className={styles.eventRow}>
                <span className={styles.eventTime}>
                  {fmtDateTime(e.occurredAt)}
                </span>
                <span
                  className={`${styles.eventType} ${
                    e.severity === "high"
                      ? styles.sevHigh
                      : e.severity === "medium"
                        ? styles.sevMid
                        : styles.sevLow
                  }`}
                >
                  {e.label}
                </span>
                {e.detail && (
                  <span className={styles.eventDetail}>{e.detail}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TrendBars · barras inline
// ═══════════════════════════════════════════════════════════════

function TrendBars({
  trend,
}: {
  trend: { label: string; value: number }[];
}) {
  const max = Math.max(0.001, ...trend.map((t) => t.value));
  const W = 1100;
  const H = 96;
  const padL = 36;
  const padR = 12;
  const padT = 8;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / trend.length;
  const barW = slot * 0.7;
  const gap = slot * 0.3;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={styles.barsSvg}
    >
      <line
        x1={padL}
        x2={padL + innerW}
        y1={padT + innerH}
        y2={padT + innerH}
        className={styles.axis}
      />
      {trend.map((t, i) => {
        const x = padL + i * slot + gap / 2;
        const h = (t.value / max) * innerH;
        const y = padT + innerH - h;
        const showLabel =
          trend.length <= 12 ||
          i === 0 ||
          i === trend.length - 1 ||
          i === Math.floor(trend.length / 2) ||
          i === Math.floor(trend.length / 4) ||
          i === Math.floor((3 * trend.length) / 4);
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0.5)}
              className={styles.bar}
            >
              <title>{`${t.label}: ${t.value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}</title>
            </rect>
            {showLabel && (
              <text
                x={x + barW / 2}
                y={padT + innerH + 14}
                textAnchor="middle"
                className={styles.barLbl}
              >
                {t.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PeerComparisons · 4 métricas · este vs flota vs grupo
// ═══════════════════════════════════════════════════════════════

function PeerComparisons({
  current,
  fleetAvg,
  groupAvg,
  groupName,
  groupCount,
}: {
  current: ActivityAgg;
  fleetAvg: ActivityAgg;
  groupAvg: ActivityAgg | null;
  groupName: string | null;
  groupCount: number | null;
}) {
  return (
    <div className={styles.peerGrid}>
      <PeerRow
        label="Distancia"
        unit="km"
        current={current.distanceKm}
        fleetAvg={fleetAvg.distanceKm}
        groupAvg={groupAvg?.distanceKm ?? null}
        groupName={groupName}
        groupCount={groupCount}
        format={(v) =>
          v.toLocaleString("es-AR", { maximumFractionDigits: 0 })
        }
      />
      <PeerRow
        label="Horas activas"
        unit="h"
        current={current.activeMin}
        fleetAvg={fleetAvg.activeMin}
        groupAvg={groupAvg?.activeMin ?? null}
        groupName={groupName}
        groupCount={groupCount}
        format={(v) => fmtHours(v)}
      />
      <PeerRow
        label="Viajes"
        unit=""
        current={current.tripCount}
        fleetAvg={fleetAvg.tripCount}
        groupAvg={groupAvg?.tripCount ?? null}
        groupName={groupName}
        groupCount={groupCount}
        format={(v) =>
          v.toLocaleString("es-AR", { maximumFractionDigits: 1 })
        }
      />
      <PeerRow
        label="Eventos"
        unit=""
        current={current.eventCount}
        fleetAvg={fleetAvg.eventCount}
        groupAvg={groupAvg?.eventCount ?? null}
        groupName={groupName}
        groupCount={groupCount}
        format={(v) =>
          v.toLocaleString("es-AR", { maximumFractionDigits: 1 })
        }
        isReverse
      />
    </div>
  );
}

function PeerRow({
  label,
  unit,
  current,
  fleetAvg,
  groupAvg,
  groupName,
  groupCount,
  format,
  isReverse = false,
}: {
  label: string;
  unit: string;
  current: number;
  fleetAvg: number;
  groupAvg: number | null;
  groupName: string | null;
  groupCount: number | null;
  format: (v: number) => string;
  isReverse?: boolean;
}) {
  const max = Math.max(current, fleetAvg, groupAvg ?? 0, 0.001);
  const fleetDelta = computeRelative(current, fleetAvg);
  const groupDelta =
    groupAvg !== null ? computeRelative(current, groupAvg) : null;

  return (
    <div className={styles.peerRow}>
      <div className={styles.peerLabel}>{label}</div>

      <div className={styles.peerLine}>
        <span className={styles.peerName}>Este objeto</span>
        <div className={styles.peerBarTrack}>
          <div
            className={styles.peerBarFillSelf}
            style={{ width: `${(current / max) * 100}%` }}
          />
        </div>
        <span className={styles.peerValueSelf}>
          {format(current)}
          {unit && <span className={styles.peerUnit}> {unit}</span>}
        </span>
      </div>

      <div className={styles.peerLine}>
        <span className={styles.peerName}>Promedio flota</span>
        <div className={styles.peerBarTrack}>
          <div
            className={styles.peerBarFill}
            style={{ width: `${(fleetAvg / max) * 100}%` }}
          />
        </div>
        <span className={styles.peerValue}>
          {format(fleetAvg)}
          {unit && <span className={styles.peerUnit}> {unit}</span>}
          {fleetDelta !== null && (
            <DeltaChip pct={fleetDelta} isReverse={isReverse} />
          )}
        </span>
      </div>

      {groupAvg !== null && groupName && (
        <div className={styles.peerLine}>
          <span className={styles.peerName}>
            Grupo {groupName}
            {groupCount !== null && ` · ${groupCount}`}
          </span>
          <div className={styles.peerBarTrack}>
            <div
              className={styles.peerBarFill}
              style={{ width: `${(groupAvg / max) * 100}%` }}
            />
          </div>
          <span className={styles.peerValue}>
            {format(groupAvg)}
            {unit && <span className={styles.peerUnit}> {unit}</span>}
            {groupDelta !== null && (
              <DeltaChip pct={groupDelta} isReverse={isReverse} />
            )}
          </span>
        </div>
      )}
    </div>
  );
}

function DeltaChip({
  pct,
  isReverse,
}: {
  pct: number;
  isReverse: boolean;
}) {
  const trend = pct > 0.02 ? "up" : pct < -0.02 ? "down" : "flat";
  const isGood =
    (trend === "up" && !isReverse) || (trend === "down" && isReverse);
  const isBad =
    (trend === "up" && isReverse) || (trend === "down" && !isReverse);
  const cls = isGood
    ? styles.chipGood
    : isBad
      ? styles.chipBad
      : styles.chipFlat;
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "·";
  const txt =
    (pct * 100 >= 0 ? "+" : "") + (pct * 100).toFixed(0) + "%";
  return (
    <span className={`${styles.peerChip} ${cls}`}>
      {arrow} {txt}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Loaders
// ═══════════════════════════════════════════════════════════════

interface ActivityAgg {
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  trend: { label: string; value: number }[];
}

async function loadActivityData(
  type: ObjectType,
  id: string,
  fromDate: string,
  toDate: string,
): Promise<ActivityAgg | null> {
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const TELEMETRY_TYPES = ["IGNITION_ON", "IGNITION_OFF"];

  let dayWhere: {
    day: { gte: Date; lt: Date };
    assetId?: string;
    personId?: string;
    asset?: { groupId: string };
  };
  let eventWhere: {
    occurredAt: { gte: Date; lt: Date };
    type: { notIn: string[] };
    assetId?: string;
    personId?: string;
    asset?: { groupId: string };
  };

  if (type === "vehiculo") {
    dayWhere = { day: { gte: fromDt, lt: toDt }, assetId: id };
    eventWhere = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      assetId: id,
    };
  } else if (type === "conductor") {
    dayWhere = { day: { gte: fromDt, lt: toDt }, personId: id };
    eventWhere = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      personId: id,
    };
  } else {
    dayWhere = { day: { gte: fromDt, lt: toDt }, asset: { groupId: id } };
    eventWhere = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      asset: { groupId: id },
    };
  }

  const [days, eventCount] = await Promise.all([
    db.assetDriverDay.findMany({
      where: dayWhere,
      select: {
        day: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
      orderBy: { day: "asc" },
    }),
    db.event.count({ where: eventWhere }),
  ]);

  if (days.length === 0 && eventCount === 0) return null;

  // Para grupo · puede haber múltiples rows el mismo día (uno por
  // asset). Sumamos por día calendario.
  const trendMap = new Map<string, number>();
  for (const d of days) {
    const key = isoDate(d.day);
    trendMap.set(key, (trendMap.get(key) ?? 0) + (d.distanceKm ?? 0));
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, value]) => ({
      label: shortDayLabel(dateIso),
      value,
    }));

  return {
    distanceKm: days.reduce((s, x) => s + (x.distanceKm ?? 0), 0),
    activeMin: days.reduce((s, x) => s + (x.activeMin ?? 0), 0),
    tripCount: days.reduce((s, x) => s + (x.tripCount ?? 0), 0),
    eventCount,
    trend,
  };
}

interface PeerStats {
  fleet: { count: number; avg: ActivityAgg } | null;
  byGroup: {
    groupId: string;
    groupName: string;
    count: number;
    avg: ActivityAgg;
  }[];
}

async function loadPeerStats(
  type: ObjectType,
  selfId: string,
  fromDate: string,
  toDate: string,
): Promise<PeerStats> {
  if (type === "grupo") return { fleet: null, byGroup: [] };

  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const TELEMETRY_TYPES = ["IGNITION_ON", "IGNITION_OFF"];

  const [days, events] = await Promise.all([
    db.assetDriverDay.findMany({
      where: { day: { gte: fromDt, lt: toDt } },
      select: {
        assetId: true,
        personId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
        asset: {
          select: {
            groupId: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.event.findMany({
      where: {
        occurredAt: { gte: fromDt, lt: toDt },
        type: { notIn: TELEMETRY_TYPES },
      },
      select: {
        assetId: true,
        personId: true,
        asset: { select: { groupId: true } },
      },
    }),
  ]);

  const ownerMap = new Map<
    string,
    {
      distanceKm: number;
      activeMin: number;
      tripCount: number;
      eventCount: number;
      groupId: string | null;
      groupName: string | null;
    }
  >();

  function getKey(assetId: string, personId: string): string {
    return type === "vehiculo" ? assetId : personId;
  }

  for (const d of days) {
    const key = getKey(d.assetId, d.personId);
    const cur = ownerMap.get(key) ?? {
      distanceKm: 0,
      activeMin: 0,
      tripCount: 0,
      eventCount: 0,
      groupId: d.asset?.groupId ?? null,
      groupName: d.asset?.group?.name ?? null,
    };
    cur.distanceKm += d.distanceKm ?? 0;
    cur.activeMin += d.activeMin ?? 0;
    cur.tripCount += d.tripCount ?? 0;
    if (!cur.groupId && d.asset?.groupId) {
      cur.groupId = d.asset.groupId;
      cur.groupName = d.asset.group?.name ?? null;
    }
    ownerMap.set(key, cur);
  }

  for (const e of events) {
    const key = type === "vehiculo" ? e.assetId : e.personId;
    if (!key) continue;
    const cur = ownerMap.get(key);
    if (cur) {
      cur.eventCount += 1;
    } else {
      ownerMap.set(key, {
        distanceKm: 0,
        activeMin: 0,
        tripCount: 0,
        eventCount: 1,
        groupId: e.asset?.groupId ?? null,
        groupName: null,
      });
    }
  }

  ownerMap.delete(selfId);

  if (ownerMap.size === 0) {
    return { fleet: null, byGroup: [] };
  }

  const all = Array.from(ownerMap.values());
  const fleetAvg: ActivityAgg = {
    distanceKm: avgOf(all.map((x) => x.distanceKm)),
    activeMin: avgOf(all.map((x) => x.activeMin)),
    tripCount: avgOf(all.map((x) => x.tripCount)),
    eventCount: avgOf(all.map((x) => x.eventCount)),
    trend: [],
  };

  const byGroupMap = new Map<
    string,
    { groupName: string; items: typeof all }
  >();
  for (const o of all) {
    if (!o.groupId || !o.groupName) continue;
    const cur = byGroupMap.get(o.groupId) ?? {
      groupName: o.groupName,
      items: [],
    };
    cur.items.push(o);
    byGroupMap.set(o.groupId, cur);
  }

  const byGroup = Array.from(byGroupMap.entries()).map(
    ([groupId, { groupName, items }]) => ({
      groupId,
      groupName,
      count: items.length,
      avg: {
        distanceKm: avgOf(items.map((x) => x.distanceKm)),
        activeMin: avgOf(items.map((x) => x.activeMin)),
        tripCount: avgOf(items.map((x) => x.tripCount)),
        eventCount: avgOf(items.map((x) => x.eventCount)),
        trend: [],
      } satisfies ActivityAgg,
    }),
  );

  return { fleet: { count: all.length, avg: fleetAvg }, byGroup };
}

async function loadOwnGroupId(
  type: ObjectType,
  id: string,
): Promise<string | null> {
  if (type !== "vehiculo") return null;
  const asset = await db.asset.findUnique({
    where: { id },
    select: { groupId: true },
  });
  return asset?.groupId ?? null;
}

interface EventRow {
  id: string;
  occurredAt: Date;
  label: string;
  detail: string | null;
  severity: "high" | "medium" | "low";
}

async function loadEvents(
  type: ObjectType,
  id: string,
  fromDate: string,
  toDate: string,
): Promise<EventRow[]> {
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  const TELEMETRY_TYPES = ["IGNITION_ON", "IGNITION_OFF"];

  let where: {
    occurredAt: { gte: Date; lt: Date };
    type: { notIn: string[] };
    assetId?: string;
    personId?: string;
    asset?: { groupId: string };
  };

  if (type === "vehiculo") {
    where = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      assetId: id,
    };
  } else if (type === "conductor") {
    where = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      personId: id,
    };
  } else {
    where = {
      occurredAt: { gte: fromDt, lt: toDt },
      type: { notIn: TELEMETRY_TYPES },
      asset: { groupId: id },
    };
  }

  const events = await db.event.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: {
      id: true,
      occurredAt: true,
      type: true,
      severity: true,
      metadata: true,
      speedKmh: true,
    },
  });

  return events.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt,
    label: humanizeEventType(e.type),
    detail: extractDetail(e.type, e.metadata, e.speedKmh),
    severity: normalizeSeverity(e.severity),
  }));
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function avgOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function computeRange(
  g: AnalysisGranularity,
  anchorIso: string,
): {
  fromDate: string;
  toDate: string;
  fromPrevDate: string;
  toPrevDate: string;
} {
  const [y, m, d] = anchorIso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));

  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

  let fromDate: Date;
  let toDate: Date;
  let fromPrevDate: Date;
  let toPrevDate: Date;

  switch (g) {
    case "day-hours":
      fromDate = toDate = new Date(date);
      fromPrevDate = toPrevDate = new Date(date);
      fromPrevDate.setUTCDate(date.getUTCDate() - 1);
      toPrevDate.setUTCDate(date.getUTCDate() - 1);
      break;
    case "week-days": {
      const dow = (date.getUTCDay() + 6) % 7;
      fromDate = new Date(date);
      fromDate.setUTCDate(date.getUTCDate() - dow);
      toDate = new Date(fromDate);
      toDate.setUTCDate(fromDate.getUTCDate() + 6);
      fromPrevDate = new Date(fromDate);
      fromPrevDate.setUTCDate(fromDate.getUTCDate() - 7);
      toPrevDate = new Date(toDate);
      toPrevDate.setUTCDate(toDate.getUTCDate() - 7);
      break;
    }
    case "month-days":
      fromDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
      );
      toDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      );
      fromPrevDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1),
      );
      toPrevDate = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0),
      );
      break;
    case "year-weeks":
    case "year-months":
      fromDate = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      toDate = new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
      fromPrevDate = new Date(Date.UTC(date.getUTCFullYear() - 1, 0, 1));
      toPrevDate = new Date(Date.UTC(date.getUTCFullYear() - 1, 11, 31));
      break;
  }

  return {
    fromDate: fmt(fromDate),
    toDate: fmt(toDate),
    fromPrevDate: fmt(fromPrevDate),
    toPrevDate: fmt(toPrevDate),
  };
}

function computeDelta(current: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return (current - prev) / prev;
}

function computeRelative(self: number, peer: number): number | null {
  if (peer === 0) return null;
  return (self - peer) / peer;
}

function fmtHours(min: number): string {
  if (min <= 0) return "0";
  return Math.floor(min / 60).toLocaleString("es-AR");
}

function fmtDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hh}:${mm}`;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shortDayLabel(iso: string): string {
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function humanizeEventType(t: string): string {
  const map: Record<string, string> = {
    SPEEDING: "Exceso de velocidad",
    HARSH_BRAKING: "Frenado brusco",
    HARSH_ACCELERATION: "Aceleración brusca",
    HARSH_CORNERING: "Curva brusca",
    IDLING: "Ralentí prolongado",
    IDLE: "Ralentí prolongado",
    GEOFENCE_ENTER: "Entrada a zona",
    GEOFENCE_EXIT: "Salida de zona",
    PANIC: "Botón de pánico",
    IMPACT: "Impacto detectado",
    AFTER_HOURS: "Encendido fuera de horario",
    POWER_DISCONNECT: "Desconexión de batería",
    LOW_BATTERY: "Batería baja",
    IGNITION_ON: "Encendido",
    IGNITION_OFF: "Apagado",
  };
  return map[t] ?? t;
}

function extractDetail(
  type: string,
  metadataStr: string | null,
  speedKmh: number | null,
): string | null {
  const SPEED_RELEVANT = ["SPEEDING", "HARSH_BRAKING", "HARSH_ACCELERATION"];
  if (SPEED_RELEVANT.includes(type) && speedKmh != null && speedKmh > 0) {
    return `${Math.round(speedKmh)} km/h`;
  }
  if (!metadataStr) return null;
  try {
    const meta = JSON.parse(metadataStr) as Record<string, unknown>;
    if (typeof meta.zone === "string") return meta.zone;
    if (typeof meta.location === "string") return meta.location;
    if (typeof meta.address === "string") return meta.address;
  } catch {
    // metadata no es JSON
  }
  return null;
}

function normalizeSeverity(s: string | null): "high" | "medium" | "low" {
  if (s === "HIGH" || s === "CRITICAL") return "high";
  if (s === "MEDIUM" || s === "WARNING") return "medium";
  return "low";
}

function deltaLabelByGranularity(g: AnalysisGranularity): string {
  switch (g) {
    case "day-hours":
      return "vs día anterior";
    case "week-days":
      return "vs semana anterior";
    case "month-days":
      return "vs mes anterior";
    case "year-weeks":
    case "year-months":
      return "vs año anterior";
    default:
      return "vs período anterior";
  }
}

function trendTitleByGranularity(g: AnalysisGranularity): string {
  switch (g) {
    case "day-hours":
      return "Distancia por hora";
    case "week-days":
      return "Distancia por día";
    case "month-days":
      return "Distancia por día";
    case "year-weeks":
      return "Distancia por semana";
    case "year-months":
      return "Distancia por mes";
    default:
      return "Distribución temporal";
  }
}
