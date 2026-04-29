import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  listTripsAndStopsByDay · Vista "Día por día" para Viajes
//  ─────────────────────────────────────────────────────────────
//  Agrupa Trip por (asset, día AR-local) y deriva paradas en
//  runtime · cada gap entre trip[n].endedAt y trip[n+1].startedAt
//  mayor a 5 minutos se modela como un Stop (parada).
//
//  Resultado · array de Day · cada Day tiene:
//    · header info (asset, driver, fecha, métricas resumen)
//    · items[] · trips y stops intercalados cronológicamente
//
//  Las paradas tienen id sintético ("stop:N") · cuando llegue el
//  Bloque 6 (modelo Sessions con paradas como entidades reales),
//  estos ids migran sin romper la UI.
// ═══════════════════════════════════════════════════════════════

const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const STOP_THRESHOLD_MS = 5 * 60 * 1000;
const LONG_STOP_THRESHOLD_MS = 60 * 60 * 1000;

export interface TripsByDayFilters {
  fromDate: string;
  toDate: string;
  assetIds?: string[];
  groupIds?: string[];
  personIds?: string[];
}

export interface DayItem_Trip {
  kind: "trip";
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  eventCount: number;
  highSeverityEventCount: number;
}

export interface DayItem_Stop {
  kind: "stop";
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  /** ¿Parada larga? (>1h) · típicamente almuerzo, descarga, fin jornada */
  isLong: boolean;
  /** Ubicación heredada del fin del viaje anterior */
  lat: number;
  lng: number;
}

export type DayItem = DayItem_Trip | DayItem_Stop;

export interface Day {
  /** Identificador estable · {assetId}:{dayIso} */
  id: string;
  dayIso: string;
  assetId: string;
  assetName: string;
  assetPlate: string | null;
  driverName: string | null;
  /** Métricas resumen del día */
  totalDistanceKm: number;
  tripCount: number;
  stopCount: number;
  totalDrivingMs: number;
  /** Inicio del primer viaje · null si día vacío (no debería pasar) */
  firstStartedAt: Date | null;
  /** Fin del último viaje · null si día vacío */
  lastEndedAt: Date | null;
  /** Items intercalados · ordenados cronológicamente · trips + stops */
  items: DayItem[];
}

function ymdAr(ts: number): string {
  const local = new Date(ts - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateRangeToUtc(
  fromDate: string,
  toDate: string,
): { startUtc: Date; endUtc: Date } {
  // AR-local 00:00:00 a UTC
  const startUtc = new Date(`${fromDate}T00:00:00.000-03:00`);
  // toDate inclusive · sumamos 1 día
  const endLocal = new Date(`${toDate}T00:00:00.000-03:00`);
  endLocal.setUTCDate(endLocal.getUTCDate() + 1);
  return { startUtc, endUtc: endLocal };
}

export async function listTripsAndStopsByDay(
  filters: TripsByDayFilters,
): Promise<Day[]> {
  const { startUtc, endUtc } = dateRangeToUtc(filters.fromDate, filters.toDate);

  // 1. Resolver filtro de asset (directo + por grupo)
  let assetFilter: string[] | null = null;
  if (filters.assetIds && filters.assetIds.length > 0) {
    assetFilter = filters.assetIds.slice();
  }
  if (filters.groupIds && filters.groupIds.length > 0) {
    const inGroups = await db.asset.findMany({
      where: { groupId: { in: filters.groupIds } },
      select: { id: true },
    });
    const ids = inGroups.map((a: { id: string }) => a.id);
    assetFilter = assetFilter
      ? assetFilter.filter((id) => ids.includes(id))
      : ids;
  }

  const where: any = {
    startedAt: { gte: startUtc, lt: endUtc },
  };
  if (assetFilter !== null) {
    if (assetFilter.length === 0) return [];
    where.assetId = { in: assetFilter };
  }
  if (filters.personIds && filters.personIds.length > 0) {
    where.personId = { in: filters.personIds };
  }

  // 2. Cargar trips con info necesaria · ordenados cronológicamente
  const trips = await db.trip.findMany({
    where,
    select: {
      id: true,
      assetId: true,
      personId: true,
      startedAt: true,
      endedAt: true,
      distanceKm: true,
      maxSpeedKmh: true,
      startLat: true,
      startLng: true,
      endLat: true,
      endLng: true,
      asset: {
        select: { id: true, name: true, plate: true },
      },
      person: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: [{ assetId: "asc" }, { startedAt: "asc" }],
  });

  if (trips.length === 0) return [];

  // 3. Conteo de eventos por trip · trip se identifica por (assetId, [startedAt, endedAt))
  // Usamos eventos del rango y los asociamos al trip que contenga su occurredAt.
  //
  // Nota técnica · SQLite tiene un límite de ~999 params por query. Con muchos
  // assetIds + el notIn de tipos, Prisma no puede dividir la query y falla.
  // Solución · NO pasamos assetId en el filtro (el rango ya acota) y
  // post-filtramos tipos IGNITION_ON/OFF en memoria. Es barato · son
  // típicamente 5-10x el número de trips.
  const uniqueAssetIds = new Set(trips.map((t) => t.assetId));
  const eventsRaw = await db.event.findMany({
    where: {
      occurredAt: { gte: startUtc, lt: endUtc },
    },
    select: {
      assetId: true,
      occurredAt: true,
      severity: true,
      type: true,
    },
  });

  // Post-filtrar · solo eventos de los assets de interés · sin telemetría
  const events = eventsRaw.filter(
    (e) =>
      uniqueAssetIds.has(e.assetId) &&
      e.type !== "IGNITION_ON" &&
      e.type !== "IGNITION_OFF",
  );

  // Indexar eventos por asset para asociación rápida
  const eventsByAsset = new Map<string, typeof events>();
  for (const e of events) {
    const arr = eventsByAsset.get(e.assetId) ?? [];
    arr.push(e);
    eventsByAsset.set(e.assetId, arr);
  }

  // 4. Agrupar por (assetId, dayIso)
  const dayMap = new Map<string, Day>();

  for (let i = 0; i < trips.length; i++) {
    const t = trips[i]!;
    const dayIso = ymdAr(t.startedAt.getTime());
    const dayKey = `${t.assetId}:${dayIso}`;

    let day = dayMap.get(dayKey);
    if (!day) {
      day = {
        id: dayKey,
        dayIso,
        assetId: t.assetId,
        assetName: t.asset.name,
        assetPlate: t.asset.plate,
        driverName: t.person
          ? `${t.person.firstName} ${t.person.lastName}`.trim()
          : null,
        totalDistanceKm: 0,
        tripCount: 0,
        stopCount: 0,
        totalDrivingMs: 0,
        firstStartedAt: null,
        lastEndedAt: null,
        items: [],
      };
      dayMap.set(dayKey, day);
    }

    // Compute KPIs per trip
    const durationMs = t.endedAt.getTime() - t.startedAt.getTime();
    const avgSpeedKmh =
      durationMs > 0 ? (t.distanceKm / (durationMs / 3600000)) : 0;

    // Eventos del trip · entre startedAt y endedAt para este asset
    const assetEvents = eventsByAsset.get(t.assetId) ?? [];
    let eventCount = 0;
    let highSeverityEventCount = 0;
    for (const e of assetEvents) {
      const ts = e.occurredAt.getTime();
      if (ts >= t.startedAt.getTime() && ts <= t.endedAt.getTime()) {
        eventCount++;
        if (e.severity === "HIGH" || e.severity === "CRITICAL") {
          highSeverityEventCount++;
        }
      }
    }

    day.items.push({
      kind: "trip",
      id: t.id,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      durationMs,
      distanceKm: t.distanceKm,
      avgSpeedKmh,
      maxSpeedKmh: t.maxSpeedKmh,
      startLat: t.startLat,
      startLng: t.startLng,
      endLat: t.endLat,
      endLng: t.endLng,
      eventCount,
      highSeverityEventCount,
    });

    day.tripCount++;
    day.totalDistanceKm += t.distanceKm;
    day.totalDrivingMs += durationMs;
    if (!day.firstStartedAt || t.startedAt < day.firstStartedAt) {
      day.firstStartedAt = t.startedAt;
    }
    if (!day.lastEndedAt || t.endedAt > day.lastEndedAt) {
      day.lastEndedAt = t.endedAt;
    }
  }

  // 5. Para cada día · derivar paradas entre trips consecutivos
  for (const day of dayMap.values()) {
    // items ya están ordenados por startedAt (vienen así del findMany)
    const sorted = day.items.filter(isTripItem).sort(
      (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
    );

    const newItems: DayItem[] = [];
    let stopIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      newItems.push(sorted[i]!);
      // Insertar parada si hay próximo viaje y el gap es significativo
      if (i < sorted.length - 1) {
        const cur = sorted[i]!;
        const next = sorted[i + 1]!;
        const gapMs = next.startedAt.getTime() - cur.endedAt.getTime();
        if (gapMs > STOP_THRESHOLD_MS) {
          stopIdx++;
          newItems.push({
            kind: "stop",
            id: `${day.id}:stop:${stopIdx}`,
            startedAt: cur.endedAt,
            endedAt: next.startedAt,
            durationMs: gapMs,
            isLong: gapMs > LONG_STOP_THRESHOLD_MS,
            lat: cur.endLat,
            lng: cur.endLng,
          });
          day.stopCount++;
        }
      }
    }
    day.items = newItems;
  }

  // 6. Convertir a array · ordenar por (día desc, asset name asc)
  return Array.from(dayMap.values()).sort((a, b) => {
    if (a.dayIso !== b.dayIso) return b.dayIso.localeCompare(a.dayIso);
    return a.assetName.localeCompare(b.assetName);
  });
}

function isTripItem(item: DayItem): item is DayItem_Trip {
  return item.kind === "trip";
}
