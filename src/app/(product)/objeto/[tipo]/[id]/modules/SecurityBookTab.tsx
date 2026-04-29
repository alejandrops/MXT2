import { db } from "@/lib/db";
import { KpiCard, EmptyState } from "@/components/maxtracker/ui";
import type { AnalysisGranularity } from "@/lib/queries";
import type { ObjectType } from "@/lib/object-modules";
import styles from "./SecurityBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  SecurityBookTab · módulo Seguridad para el Libro · F2.D
//  ─────────────────────────────────────────────────────────────
//  Estructura · template estructural común con Activity:
//    1. KPIs del período · 4 cards
//       · Activas (estado OPEN ahora · scoped al objeto)
//       · Total del período
//       · Severity máxima del período
//       · MTTR · tiempo medio de resolución
//    2. Distribución temporal · barras por bucket
//    3. Lifecycle del período · breakdown por estado
//    4. Lista cronológica · alarmas del período
//
//  Schema usado:
//    Alarm · domain (CONDUCCION/SEGURIDAD), type (enum),
//            severity (enum), status (OPEN/ATTENDED/CLOSED/DISMISSED),
//            triggeredAt, attendedAt, closedAt
//
//  Comportamiento:
//    · Por default este Libro muestra alarmas de TODOS los
//      domains (Seguridad + Conducción · transversales).
//    · El módulo Conducción cuando se construya hará su propio
//      filtro por domain=CONDUCCION en su tab.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

export async function SecurityBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const { fromDate, toDate, fromPrevDate, toPrevDate } = computeRange(
    granularity,
    anchorIso,
  );

  const [data, dataPrev, activeNow] = await Promise.all([
    loadAlarms(type, id, fromDate, toDate),
    loadAlarms(type, id, fromPrevDate, toPrevDate),
    loadActiveAlarmsCount(type, id),
  ]);

  if (data.alarms.length === 0 && activeNow === 0) {
    return (
      <div className={styles.body}>
        <EmptyState
          title="Sin alarmas en el período"
          hint="Este objeto no registró alarmas de seguridad ni conducción en el período seleccionado."
        />
      </div>
    );
  }

  const deltaTotal = computeDelta(
    data.alarms.length,
    dataPrev?.alarms.length ?? null,
  );
  const deltaMttr = computeDelta(data.mttrMin, dataPrev?.mttrMin ?? null);

  const deltaLabel = deltaLabelByGranularity(granularity);
  const trendTitle = trendTitleByGranularity(granularity);

  // Lifecycle counts
  const lifecycle = {
    OPEN: data.alarms.filter((a) => a.status === "OPEN").length,
    ATTENDED: data.alarms.filter((a) => a.status === "ATTENDED").length,
    CLOSED: data.alarms.filter((a) => a.status === "CLOSED").length,
    DISMISSED: data.alarms.filter((a) => a.status === "DISMISSED").length,
  };

  return (
    <div className={styles.body}>
      {/* ── 1. KPIs ────────────────────────────────────────── */}
      <section className={styles.kpiGrid}>
        <KpiCard
          size="md"
          label="Activas ahora"
          value={activeNow.toLocaleString("es-AR")}
        />
        <KpiCard
          size="md"
          label="Total del período"
          value={data.alarms.length.toLocaleString("es-AR")}
          delta={deltaTotal}
          deltaLabel={deltaLabel}
          isReverseDelta
        />
        <KpiCard
          size="md"
          label="Severity máx"
          value={severityLabel(data.maxSeverity)}
        />
        <KpiCard
          size="md"
          label="MTTR"
          value={data.mttrMin > 0 ? fmtDuration(data.mttrMin) : "—"}
          unit={data.mttrMin > 0 ? undefined : ""}
          delta={deltaMttr}
          deltaLabel={deltaLabel}
          isReverseDelta
        />
      </section>

      {/* ── 2. Distribución temporal de alarmas ────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{trendTitle}</h2>
        </header>
        {data.trend.length === 0 ? (
          <div className={styles.empty}>Sin alarmas en el período</div>
        ) : (
          <TrendBars trend={data.trend} />
        )}
      </section>

      {/* ── 3. Lifecycle del período ───────────────────────── */}
      {data.alarms.length > 0 && (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Lifecycle del período</h2>
            <span className={styles.sectionHint}>
              estado actual de las alarmas que ocurrieron en el período
            </span>
          </header>
          <LifecycleBreakdown
            counts={lifecycle}
            total={data.alarms.length}
          />
        </section>
      )}

      {/* ── 4. Lista cronológica ───────────────────────────── */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Alarmas del período · {data.alarms.length}
            {data.alarms.length === 50 ? "+" : ""}
          </h2>
        </header>
        {data.alarms.length === 0 ? (
          <EmptyState
            title="Sin alarmas en el período"
            hint="No se dispararon alarmas para este objeto."
            size="compact"
          />
        ) : (
          <ul className={styles.alarmList}>
            {data.alarms.map((a) => (
              <li key={a.id} className={styles.alarmRow}>
                <span className={styles.alarmTime}>
                  {fmtDateTime(a.triggeredAt)}
                </span>
                <span
                  className={`${styles.alarmSev} ${sevClass(a.severity)}`}
                  title={severityLabel(a.severity)}
                >
                  {severityShort(a.severity)}
                </span>
                <span className={styles.alarmType}>
                  {humanizeAlarmType(a.type)}
                </span>
                <span className={styles.alarmDomain}>
                  {humanizeDomain(a.domain)}
                </span>
                <span
                  className={`${styles.alarmStatus} ${statusClass(a.status)}`}
                >
                  {statusLabel(a.status)}
                  {a.attendedAt && a.status !== "OPEN" && (
                    <span className={styles.alarmDuration}>
                      · {fmtDuration(
                        (a.attendedAt.getTime() -
                          a.triggeredAt.getTime()) /
                          60000,
                      )}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TrendBars · barras inline · 2 colores (críticas en rojo)
// ═══════════════════════════════════════════════════════════════

function TrendBars({
  trend,
}: {
  trend: { label: string; total: number; critical: number }[];
}) {
  const max = Math.max(0.001, ...trend.map((t) => t.total));
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
        const totalH = (t.total / max) * innerH;
        const critH = (t.critical / max) * innerH;
        const yTotal = padT + innerH - totalH;
        const yCrit = padT + innerH - critH;
        const showLabel =
          trend.length <= 12 ||
          i === 0 ||
          i === trend.length - 1 ||
          i === Math.floor(trend.length / 2) ||
          i === Math.floor(trend.length / 4) ||
          i === Math.floor((3 * trend.length) / 4);
        return (
          <g key={i}>
            {/* Total · gris/azul claro */}
            <rect
              x={x}
              y={yTotal}
              width={barW}
              height={Math.max(totalH, 0.5)}
              className={styles.barTotal}
            >
              <title>{`${t.label}: ${t.total} (${t.critical} críticas)`}</title>
            </rect>
            {/* Críticas · overlay rojo */}
            {t.critical > 0 && (
              <rect
                x={x}
                y={yCrit}
                width={barW}
                height={Math.max(critH, 0.5)}
                className={styles.barCritical}
              />
            )}
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
//  Lifecycle breakdown · 4 estados horizontal
// ═══════════════════════════════════════════════════════════════

function LifecycleBreakdown({
  counts,
  total,
}: {
  counts: { OPEN: number; ATTENDED: number; CLOSED: number; DISMISSED: number };
  total: number;
}) {
  const items: { key: keyof typeof counts; label: string; cls: string }[] = [
    { key: "OPEN", label: "Sin atender", cls: styles.lcOpen },
    { key: "ATTENDED", label: "Atendidas", cls: styles.lcAttended },
    { key: "CLOSED", label: "Cerradas", cls: styles.lcClosed },
    { key: "DISMISSED", label: "Descartadas", cls: styles.lcDismissed },
  ];

  return (
    <div className={styles.lcGrid}>
      {items.map((item) => {
        const v = counts[item.key];
        const pct = total > 0 ? (v / total) * 100 : 0;
        return (
          <div key={item.key} className={styles.lcRow}>
            <span className={styles.lcLabel}>{item.label}</span>
            <div className={styles.lcBarTrack}>
              <div
                className={`${styles.lcBarFill} ${item.cls}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={styles.lcValue}>
              {v}
              <span className={styles.lcPct}>· {pct.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Loaders
// ═══════════════════════════════════════════════════════════════

interface AlarmRow {
  id: string;
  triggeredAt: Date;
  attendedAt: Date | null;
  closedAt: Date | null;
  domain: string;
  type: string;
  severity: string;
  status: string;
}

interface AlarmsAgg {
  alarms: AlarmRow[];
  maxSeverity: string;
  mttrMin: number; // tiempo medio en minutos para alarmas atendidas/cerradas
  trend: { label: string; total: number; critical: number }[];
}

async function loadAlarms(
  type: ObjectType,
  id: string,
  fromDate: string,
  toDate: string,
): Promise<AlarmsAgg> {
  const fromDt = new Date(`${fromDate}T03:00:00Z`);
  const toDt = new Date(`${toDate}T03:00:00Z`);
  toDt.setUTCDate(toDt.getUTCDate() + 1);

  let where: {
    triggeredAt: { gte: Date; lt: Date };
    assetId?: string;
    personId?: string;
    asset?: { groupId: string };
  };

  if (type === "vehiculo") {
    where = { triggeredAt: { gte: fromDt, lt: toDt }, assetId: id };
  } else if (type === "conductor") {
    where = { triggeredAt: { gte: fromDt, lt: toDt }, personId: id };
  } else {
    where = {
      triggeredAt: { gte: fromDt, lt: toDt },
      asset: { groupId: id },
    };
  }

  const alarms = await db.alarm.findMany({
    where,
    orderBy: { triggeredAt: "desc" },
    take: 50,
    select: {
      id: true,
      triggeredAt: true,
      attendedAt: true,
      closedAt: true,
      domain: true,
      type: true,
      severity: true,
      status: true,
    },
  });

  // Max severity
  const sevOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
  let maxSev: keyof typeof sevOrder = "LOW";
  for (const a of alarms) {
    const s = (a.severity as keyof typeof sevOrder) ?? "LOW";
    if (sevOrder[s] > sevOrder[maxSev]) maxSev = s;
  }

  // MTTR · solo de alarmas que tienen tiempo de cierre
  const closedDurations = alarms
    .filter((a) => a.closedAt && a.status === "CLOSED")
    .map((a) =>
      a.closedAt
        ? (a.closedAt.getTime() - a.triggeredAt.getTime()) / 60000
        : 0,
    );
  const mttrMin =
    closedDurations.length > 0
      ? closedDurations.reduce((s, x) => s + x, 0) / closedDurations.length
      : 0;

  // Trend · agrupado por día (simple para todas las granularidades en MVP)
  const trendMap = new Map<string, { total: number; critical: number }>();
  for (const a of alarms) {
    const key = isoDate(a.triggeredAt);
    const cur = trendMap.get(key) ?? { total: 0, critical: 0 };
    cur.total += 1;
    if (a.severity === "CRITICAL") cur.critical += 1;
    trendMap.set(key, cur);
  }
  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateIso, value]) => ({
      label: shortDayLabel(dateIso),
      ...value,
    }));

  return {
    alarms: alarms as AlarmRow[],
    maxSeverity: maxSev,
    mttrMin,
    trend,
  };
}

async function loadActiveAlarmsCount(
  type: ObjectType,
  id: string,
): Promise<number> {
  let where: {
    status: string;
    assetId?: string;
    personId?: string;
    asset?: { groupId: string };
  };

  if (type === "vehiculo") {
    where = { status: "OPEN", assetId: id };
  } else if (type === "conductor") {
    where = { status: "OPEN", personId: id };
  } else {
    where = { status: "OPEN", asset: { groupId: id } };
  }

  return db.alarm.count({ where });
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

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

function fmtDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hh}:${mm}`;
}

function fmtDuration(min: number): string {
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d${remH}h`;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function shortDayLabel(iso: string): string {
  const parts = iso.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function severityLabel(s: string): string {
  const map: Record<string, string> = {
    CRITICAL: "Crítica",
    HIGH: "Alta",
    MEDIUM: "Media",
    LOW: "Baja",
  };
  return map[s] ?? s;
}

function severityShort(s: string): string {
  const map: Record<string, string> = {
    CRITICAL: "CRIT",
    HIGH: "ALTA",
    MEDIUM: "MED",
    LOW: "BAJA",
  };
  return map[s] ?? s;
}

function sevClass(s: string): string {
  if (s === "CRITICAL") return styles.sevCritical;
  if (s === "HIGH") return styles.sevHigh;
  if (s === "MEDIUM") return styles.sevMedium;
  return styles.sevLow;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    OPEN: "Sin atender",
    ATTENDED: "Atendida",
    CLOSED: "Cerrada",
    DISMISSED: "Descartada",
  };
  return map[s] ?? s;
}

function statusClass(s: string): string {
  if (s === "OPEN") return styles.statusOpen;
  if (s === "ATTENDED") return styles.statusAttended;
  if (s === "CLOSED") return styles.statusClosed;
  return styles.statusDismissed;
}

function humanizeDomain(d: string): string {
  if (d === "CONDUCCION") return "Conducción";
  if (d === "SEGURIDAD") return "Seguridad";
  return d;
}

function humanizeAlarmType(t: string): string {
  const map: Record<string, string> = {
    HARSH_DRIVING_PATTERN: "Patrón de conducción agresiva",
    SPEEDING_CRITICAL: "Exceso de velocidad crítico",
    RECKLESS_BEHAVIOR: "Conducción imprudente",
    PANIC: "Botón de pánico",
    UNAUTHORIZED_USE: "Uso no autorizado",
    SABOTAGE: "Sabotaje",
    GPS_DISCONNECT: "Desconexión GPS",
    POWER_DISCONNECT: "Desconexión eléctrica",
    JAMMING: "Inhibición de señal",
    TRAILER_DETACH: "Desenganche de acoplado",
    CARGO_BREACH: "Apertura de carga",
    DOOR_BREACH: "Apertura de puerta",
    GEOFENCE_BREACH_CRITICAL: "Salida de zona crítica",
    DEVICE_OFFLINE: "Dispositivo sin reportar",
  };
  return map[t] ?? t;
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
      return "Alarmas por hora";
    case "week-days":
    case "month-days":
      return "Alarmas por día";
    case "year-weeks":
      return "Alarmas por semana";
    case "year-months":
      return "Alarmas por mes";
    default:
      return "Distribución temporal";
  }
}
