import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BoletinHeader } from "@/components/maxtracker/boletin/BoletinHeader";
import { BlockA_ResumenEjecutivo } from "@/components/maxtracker/boletin/BlockA_ResumenEjecutivo";
import { BlockB_SaludOperativa } from "@/components/maxtracker/boletin/BlockB_SaludOperativa";
import { BlockC_PerformanceGrupos } from "@/components/maxtracker/boletin/BlockC_PerformanceGrupos";
import { BlockD_TopVehiculos } from "@/components/maxtracker/boletin/BlockD_TopVehiculos";
import { BlockE_TopConductores } from "@/components/maxtracker/boletin/BlockE_TopConductores";
import { BlockF_Seguridad } from "@/components/maxtracker/boletin/BlockF_Seguridad";
import { BlockG_Conduccion } from "@/components/maxtracker/boletin/BlockG_Conduccion";
import { BlockH_AnomaliasEstadisticas } from "@/components/maxtracker/boletin/BlockH_AnomaliasEstadisticas";
import { BlockJ_Highlights } from "@/components/maxtracker/boletin/BlockJ_Highlights";
import styles from "./BoletinPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  /direccion/boletin/[period]
//  ─────────────────────────────────────────────────────────────
//  Boletín mensual · producto editorial pre-generado al cierre.
//  Lote 1 · esqueleto + Bloque A (Resumen ejecutivo) +
//  Bloque B (Salud operativa).
//
//  Bloques previstos (entregados en lotes sucesivos):
//    A · Resumen ejecutivo · KPIs principales del mes
//    B · Salud operativa · totales y promedios por vehículo
//    C · Performance por grupo · ranking + box-plot
//    D · Top y bottom · vehículos
//    E · Top y bottom · conductores
//    F · Seguridad · alarmas
//    G · Conducción · eventos
//    H · Anomalías estadísticas
//    I · Sostenibilidad (placeholder por ahora)
//    J · Highlights y observaciones · texto editorial generado
//
//  URL formato · /direccion/boletin/YYYY-MM
//  ej · /direccion/boletin/2026-03
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ period: string }>;
}

const PERIOD_RX = /^(\d{4})-(0[1-9]|1[0-2])$/;

export default async function BoletinPage({ params }: PageProps) {
  const { period } = await params;
  const match = period.match(PERIOD_RX);
  if (!match) notFound();

  const year = Number(match[1]);
  const month = Number(match[2]);

  // Rango del mes · AR-local · el día 1 a las 00:00 AR es el
  // mismo instante UTC que día 1 a las 03:00 UTC.
  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0));
  const nextMonthStartUtc = new Date(Date.UTC(year, month, 1, 3, 0, 0));

  // Período anterior para deltas
  const prevMonthStartUtc = new Date(Date.UTC(year, month - 2, 1, 3, 0, 0));
  const prevMonthEndUtc = monthStartUtc;

  const data = await loadBoletinData({
    monthStart: monthStartUtc,
    monthEnd: nextMonthStartUtc,
    prevStart: prevMonthStartUtc,
    prevEnd: prevMonthEndUtc,
  });

  // Período anterior y siguiente para navigator
  const prevPeriod = `${month === 1 ? year - 1 : year}-${String(
    month === 1 ? 12 : month - 1,
  ).padStart(2, "0")}`;
  const nextPeriod = `${month === 12 ? year + 1 : year}-${String(
    month === 12 ? 1 : month + 1,
  ).padStart(2, "0")}`;

  // El boletín solo existe para meses ya cerrados · siguiente solo
  // si está en el pasado o es el mes actual cerrado
  const todayUtc = new Date();
  const todayAR = new Date(todayUtc.getTime() - 3 * 60 * 60 * 1000);
  const nextStartUtc = new Date(
    Date.UTC(
      month === 12 ? year + 1 : year,
      month === 12 ? 0 : month,
      1,
      3,
      0,
      0,
    ),
  );
  const hasNext = todayAR.getTime() > nextStartUtc.getTime();

  return (
    <div className={styles.boletin}>
      <BoletinHeader
        year={year}
        month={month}
        prevPeriod={prevPeriod}
        nextPeriod={hasNext ? nextPeriod : null}
      />

      <article className={styles.body}>
        <BlockA_ResumenEjecutivo data={data} />
        <BlockB_SaludOperativa data={data} />
        <BlockC_PerformanceGrupos data={data} />
        <BlockD_TopVehiculos data={data} />
        <BlockE_TopConductores data={data} />
        <BlockF_Seguridad data={data} />
        <BlockG_Conduccion data={data} />

        <BlockH_AnomaliasEstadisticas data={data} />

        {/* Bloque I · Sostenibilidad · placeholder hasta que exista el módulo */}
        <BlockPlaceholder
          letter="I"
          title="Sostenibilidad · combustible"
          hint="Cuando el módulo esté construido"
        />

        <BlockJ_Highlights data={data} />
      </article>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Loader compartido por todos los bloques
// ═══════════════════════════════════════════════════════════════

export interface BoletinData {
  // Período actual
  current: {
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    eventCount: number;
    alarmCount: number;
    activeAssetCount: number;
    activeDriverCount: number;
  };
  // Período anterior · para deltas
  previous: {
    distanceKm: number;
    activeMin: number;
    tripCount: number;
    eventCount: number;
    alarmCount: number;
  };
  // Total flota
  fleet: {
    totalAssets: number;
    totalDrivers: number;
    totalGroups: number;
  };
  // Días con actividad por día calendario · para distribución temporal
  daily: { day: string; distanceKm: number }[];
  // Performance por grupo · usado por Bloque C
  groups: GroupRow[];
  // Vehículos con eventos · usado por Bloque D
  vehicles: VehicleRow[];
  // Conductores con score · usado por Bloque E
  drivers: DriverRow[];
  // Alarmas detalladas · usado por Bloque F
  alarms: {
    /** Total del período (mismo dato que current.alarmCount, replicado para conveniencia) */
    total: number;
    /** Activas al cierre (status OPEN al momento del render) */
    activeAtClose: number;
    /** MTTR · tiempo medio de cierre en minutos · solo CLOSED */
    mttrMin: number;
    /** Severity máxima del período · null si no hay alarmas */
    maxSeverity: string | null;
    /** Breakdown por severity · 4 buckets */
    bySeverity: { severity: string; count: number }[];
    /** Breakdown por domain · 2 buckets · CONDUCCION/SEGURIDAD */
    byDomain: { domain: string; count: number }[];
    /** Top 5 vehículos con más alarmas · ranking simple */
    topVehicles: { assetId: string; assetName: string; plate: string | null; count: number }[];
  };
  // Eventos por tipo · usado por Bloque G
  eventsByType: { type: string; count: number }[];
}

export interface GroupRow {
  groupId: string;
  groupName: string;
  assetCount: number;
  distanceKm: number;
  activeMin: number;
  tripCount: number;
  eventCount: number;
  /** Eventos por cada 100 km · proxy de calidad (menos = mejor) */
  eventsPer100km: number;
}

export interface VehicleRow {
  assetId: string;
  assetName: string;
  plate: string | null;
  groupName: string | null;
  distanceKm: number;
  /** Minutos en marcha · útil para Bloque H (anomalías) */
  activeMin: number;
  /** Cantidad de viajes · útil para Bloque H (anomalías) */
  tripCount: number;
  eventCount: number;
  /** Eventos por cada 100 km · ranking se hace por esto */
  eventsPer100km: number;
}

export interface DriverRow {
  personId: string;
  fullName: string;
  /** Score 0-100 · más alto = mejor · viene de Person.safetyScore */
  safetyScore: number;
  distanceKm: number;
  tripCount: number;
  eventCount: number;
}

async function loadBoletinData(args: {
  monthStart: Date;
  monthEnd: Date;
  prevStart: Date;
  prevEnd: Date;
}): Promise<BoletinData> {
  const TELEMETRY_TYPES = ["IGNITION_ON", "IGNITION_OFF"];

  const [
    currDays,
    prevDays,
    currEventCount,
    prevEventCount,
    currAlarmCount,
    prevAlarmCount,
    totalAssets,
    totalDrivers,
    totalGroups,
    eventsByAsset,
    eventsByPerson,
    persons,
    alarmsForPeriod,
    activeAlarmsAtClose,
    eventsByTypeRaw,
  ] = await Promise.all([
    db.assetDriverDay.findMany({
      where: { day: { gte: args.monthStart, lt: args.monthEnd } },
      select: {
        day: true,
        assetId: true,
        personId: true,
        distanceKm: true,
        activeMin: true,
        tripCount: true,
        asset: {
          select: {
            id: true,
            name: true,
            plate: true,
            groupId: true,
            group: { select: { id: true, name: true } },
          },
        },
        person: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    db.assetDriverDay.findMany({
      where: { day: { gte: args.prevStart, lt: args.prevEnd } },
      select: {
        distanceKm: true,
        activeMin: true,
        tripCount: true,
      },
    }),
    db.event.count({
      where: {
        occurredAt: { gte: args.monthStart, lt: args.monthEnd },
        type: { notIn: TELEMETRY_TYPES },
      },
    }),
    db.event.count({
      where: {
        occurredAt: { gte: args.prevStart, lt: args.prevEnd },
        type: { notIn: TELEMETRY_TYPES },
      },
    }),
    db.alarm.count({
      where: { triggeredAt: { gte: args.monthStart, lt: args.monthEnd } },
    }),
    db.alarm.count({
      where: { triggeredAt: { gte: args.prevStart, lt: args.prevEnd } },
    }),
    db.asset.count(),
    db.person.count(),
    db.group.count(),
    // Eventos agregados por asset · para Bloques C y D
    db.event.groupBy({
      by: ["assetId"],
      where: {
        occurredAt: { gte: args.monthStart, lt: args.monthEnd },
        type: { notIn: TELEMETRY_TYPES },
      },
      _count: { _all: true },
    }),
    // Eventos agregados por persona · para Bloque E
    db.event.groupBy({
      by: ["personId"],
      where: {
        occurredAt: { gte: args.monthStart, lt: args.monthEnd },
        type: { notIn: TELEMETRY_TYPES },
        personId: { not: null },
      },
      _count: { _all: true },
    }),
    // Personas con safetyScore para drivers ranking
    db.person.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        safetyScore: true,
      },
    }),
    // Alarmas del período · detalle para Bloque F
    db.alarm.findMany({
      where: { triggeredAt: { gte: args.monthStart, lt: args.monthEnd } },
      select: {
        id: true,
        assetId: true,
        domain: true,
        severity: true,
        status: true,
        triggeredAt: true,
        closedAt: true,
        asset: {
          select: { id: true, name: true, plate: true },
        },
      },
    }),
    // Alarmas activas (OPEN) al cierre del período · "abiertas pendientes"
    db.alarm.count({
      where: {
        status: "OPEN",
        triggeredAt: { lt: args.monthEnd },
      },
    }),
    // Eventos por tipo · top tipos del período · para Bloque G
    db.event.groupBy({
      by: ["type"],
      where: {
        occurredAt: { gte: args.monthStart, lt: args.monthEnd },
        type: { notIn: TELEMETRY_TYPES },
      },
      _count: { _all: true },
    }),
  ]);

  // Activos del período
  const activeAssetIds = new Set(currDays.map((d) => d.assetId));
  const activeDriverIds = new Set(currDays.map((d) => d.personId));

  // Distribución diaria
  const dailyMap = new Map<string, number>();
  for (const d of currDays) {
    const key = isoDate(d.day);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + (d.distanceKm ?? 0));
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, distanceKm]) => ({ day, distanceKm }));

  // Eventos por assetId · para joinear con vehículos/grupos
  const eventsByAssetMap = new Map<string, number>();
  for (const e of eventsByAsset) {
    eventsByAssetMap.set(e.assetId, e._count._all);
  }
  const eventsByPersonMap = new Map<string, number>();
  for (const e of eventsByPerson) {
    if (e.personId) eventsByPersonMap.set(e.personId, e._count._all);
  }

  // ── Vehículos · agrupar currDays por assetId ────────────────
  const assetMap = new Map<
    string,
    {
      assetId: string;
      assetName: string;
      plate: string | null;
      groupId: string | null;
      groupName: string | null;
      distanceKm: number;
      activeMin: number;
      tripCount: number;
    }
  >();

  for (const d of currDays) {
    const cur = assetMap.get(d.assetId) ?? {
      assetId: d.assetId,
      assetName: d.asset?.name ?? d.assetId,
      plate: d.asset?.plate ?? null,
      groupId: d.asset?.groupId ?? null,
      groupName: d.asset?.group?.name ?? null,
      distanceKm: 0,
      activeMin: 0,
      tripCount: 0,
    };
    cur.distanceKm += d.distanceKm ?? 0;
    cur.activeMin += d.activeMin ?? 0;
    cur.tripCount += d.tripCount ?? 0;
    assetMap.set(d.assetId, cur);
  }

  const vehicles: VehicleRow[] = Array.from(assetMap.values()).map((a) => {
    const eventCount = eventsByAssetMap.get(a.assetId) ?? 0;
    const eventsPer100km =
      a.distanceKm > 0 ? (eventCount / a.distanceKm) * 100 : 0;
    return {
      assetId: a.assetId,
      assetName: a.assetName,
      plate: a.plate,
      groupName: a.groupName,
      distanceKm: a.distanceKm,
      activeMin: a.activeMin,
      tripCount: a.tripCount,
      eventCount,
      eventsPer100km,
    };
  });

  // ── Grupos · agrupar vehículos por groupId ──────────────────
  const groupMap = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      assetIds: Set<string>;
      distanceKm: number;
      activeMin: number;
      tripCount: number;
      eventCount: number;
    }
  >();

  for (const a of assetMap.values()) {
    if (!a.groupId || !a.groupName) continue;
    const cur = groupMap.get(a.groupId) ?? {
      groupId: a.groupId,
      groupName: a.groupName,
      assetIds: new Set<string>(),
      distanceKm: 0,
      activeMin: 0,
      tripCount: 0,
      eventCount: 0,
    };
    cur.assetIds.add(a.assetId);
    cur.distanceKm += a.distanceKm;
    cur.activeMin += a.activeMin;
    cur.tripCount += a.tripCount;
    cur.eventCount += eventsByAssetMap.get(a.assetId) ?? 0;
    groupMap.set(a.groupId, cur);
  }

  const groups: GroupRow[] = Array.from(groupMap.values())
    .map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      assetCount: g.assetIds.size,
      distanceKm: g.distanceKm,
      activeMin: g.activeMin,
      tripCount: g.tripCount,
      eventCount: g.eventCount,
      eventsPer100km:
        g.distanceKm > 0 ? (g.eventCount / g.distanceKm) * 100 : 0,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm);

  // ── Conductores · juntar safetyScore con datos del período ──
  const driverMap = new Map<
    string,
    {
      personId: string;
      fullName: string;
      distanceKm: number;
      tripCount: number;
    }
  >();

  for (const d of currDays) {
    const cur = driverMap.get(d.personId) ?? {
      personId: d.personId,
      fullName: d.person
        ? `${d.person.firstName} ${d.person.lastName}`.trim()
        : d.personId,
      distanceKm: 0,
      tripCount: 0,
    };
    cur.distanceKm += d.distanceKm ?? 0;
    cur.tripCount += d.tripCount ?? 0;
    driverMap.set(d.personId, cur);
  }

  const personScoreMap = new Map<string, number>();
  for (const p of persons) {
    personScoreMap.set(p.id, p.safetyScore ?? 75);
  }

  const drivers: DriverRow[] = Array.from(driverMap.values()).map((d) => ({
    personId: d.personId,
    fullName: d.fullName,
    safetyScore: personScoreMap.get(d.personId) ?? 75,
    distanceKm: d.distanceKm,
    tripCount: d.tripCount,
    eventCount: eventsByPersonMap.get(d.personId) ?? 0,
  }));

  // ── Alarmas · agregaciones para Bloque F ────────────────────
  const sevOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 } as const;
  let maxSev: keyof typeof sevOrder | null = null;
  for (const a of alarmsForPeriod) {
    const s = (a.severity as keyof typeof sevOrder) ?? "LOW";
    if (maxSev === null || sevOrder[s] > sevOrder[maxSev]) maxSev = s;
  }

  // MTTR · solo CLOSED con closedAt
  const mttrSamples: number[] = [];
  for (const a of alarmsForPeriod) {
    if (a.status === "CLOSED" && a.closedAt) {
      mttrSamples.push((a.closedAt.getTime() - a.triggeredAt.getTime()) / 60000);
    }
  }
  const mttrMin =
    mttrSamples.length > 0
      ? mttrSamples.reduce((s, x) => s + x, 0) / mttrSamples.length
      : 0;

  // Breakdown por severity · 4 buckets fijos en orden
  const sevCount: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  for (const a of alarmsForPeriod) {
    if (a.severity in sevCount) sevCount[a.severity]++;
  }
  const bySeverity = Object.entries(sevCount).map(([severity, count]) => ({
    severity,
    count,
  }));

  // Breakdown por domain · 2 buckets · CONDUCCION/SEGURIDAD
  const domCount: Record<string, number> = {
    CONDUCCION: 0,
    SEGURIDAD: 0,
  };
  for (const a of alarmsForPeriod) {
    if (a.domain in domCount) domCount[a.domain]++;
  }
  const byDomain = Object.entries(domCount).map(([domain, count]) => ({
    domain,
    count,
  }));

  // Top 5 vehículos con más alarmas
  const alarmsByAssetMap = new Map<
    string,
    { assetId: string; assetName: string; plate: string | null; count: number }
  >();
  for (const a of alarmsForPeriod) {
    if (!a.asset) continue;
    const cur = alarmsByAssetMap.get(a.assetId) ?? {
      assetId: a.assetId,
      assetName: a.asset.name,
      plate: a.asset.plate,
      count: 0,
    };
    cur.count++;
    alarmsByAssetMap.set(a.assetId, cur);
  }
  const topAlarmVehicles = Array.from(alarmsByAssetMap.values())
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);

  // ── Eventos por tipo · top tipos para Bloque G ──────────────
  const eventsByType = eventsByTypeRaw
    .map((e) => ({ type: e.type, count: e._count._all }))
    .sort((x, y) => y.count - x.count);

  return {
    current: {
      distanceKm: currDays.reduce((s, x) => s + (x.distanceKm ?? 0), 0),
      activeMin: currDays.reduce((s, x) => s + (x.activeMin ?? 0), 0),
      tripCount: currDays.reduce((s, x) => s + (x.tripCount ?? 0), 0),
      eventCount: currEventCount,
      alarmCount: currAlarmCount,
      activeAssetCount: activeAssetIds.size,
      activeDriverCount: activeDriverIds.size,
    },
    previous: {
      distanceKm: prevDays.reduce((s, x) => s + (x.distanceKm ?? 0), 0),
      activeMin: prevDays.reduce((s, x) => s + (x.activeMin ?? 0), 0),
      tripCount: prevDays.reduce((s, x) => s + (x.tripCount ?? 0), 0),
      eventCount: prevEventCount,
      alarmCount: prevAlarmCount,
    },
    fleet: {
      totalAssets,
      totalDrivers,
      totalGroups,
    },
    daily,
    groups,
    vehicles,
    drivers,
    alarms: {
      total: alarmsForPeriod.length,
      activeAtClose: activeAlarmsAtClose,
      mttrMin,
      maxSeverity: maxSev,
      bySeverity,
      byDomain,
      topVehicles: topAlarmVehicles,
    },
    eventsByType,
  };
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
//  Placeholder para bloques no implementados
// ═══════════════════════════════════════════════════════════════

function BlockPlaceholder({
  letter,
  title,
  hint,
}: {
  letter: string;
  title: string;
  hint: string;
}) {
  return (
    <section className={styles.placeholder}>
      <div className={styles.placeholderLetter}>{letter}</div>
      <div className={styles.placeholderBody}>
        <h2 className={styles.placeholderTitle}>{title}</h2>
        <p className={styles.placeholderHint}>{hint}</p>
      </div>
    </section>
  );
}
