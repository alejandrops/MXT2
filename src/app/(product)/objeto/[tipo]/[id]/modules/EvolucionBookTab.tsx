// @ts-nocheck · pre-existing patterns
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import type { ObjectType } from "@/lib/object-modules";
import type { AnalysisGranularity } from "@/lib/queries";
import { EmptyState } from "@/components/maxtracker/ui";
import styles from "./EvolucionBookTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  EvolucionBookTab · S4-L1
//  ─────────────────────────────────────────────────────────────
//  Vista gráfica/temporal del objeto · barras por bucket del
//  período seleccionado.
//
//  · Granularity day-hours    → 24 barras (una por hora)
//  · Granularity week-days    → 7 barras (una por día de semana)
//  · Granularity month-days   → ~30 barras
//  · Granularity year-months  → 12 barras (una por mes)
//
//  Métricas mostradas (4 grids stack):
//    1. Distancia recorrida
//    2. Viajes realizados
//    3. Tiempo en marcha
//    4. Eventos
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: ObjectType;
  id: string;
  granularity: AnalysisGranularity;
  anchorIso: string;
}

interface Bucket {
  idx: number;
  label: string;
  shortLabel: string;
  isToday: boolean;
  startUtc: Date;
  endUtc: Date;
  trips: number;
  distanceKm: number;
  durationMs: number;
  events: number;
}

export async function EvolucionBookTab({
  type,
  id,
  granularity,
  anchorIso,
}: Props) {
  const session = await getSession();
  const accountId = resolveAccountScope(session, "actividad", null);

  const buckets = computeBuckets(granularity, anchorIso);
  const assetIds = await resolveAssetIds(type, id);

  if (assetIds.length === 0) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Sin datos para mostrar"
          description="Este objeto no tiene viajes registrados aún."
        />
      </div>
    );
  }

  // Cargar trips y events del rango completo · agrupar en cliente
  const fullStart = buckets[0]!.startUtc;
  const fullEnd = buckets[buckets.length - 1]!.endUtc;

  const tripWhere: any = {
    assetId: { in: assetIds },
    startedAt: { gte: fullStart, lte: fullEnd },
  };
  const eventWhere: any = {
    assetId: { in: assetIds },
    occurredAt: { gte: fullStart, lte: fullEnd },
  };
  if (type === "conductor") {
    tripWhere.personId = id;
    eventWhere.personId = id;
  }

  const [trips, events] = await Promise.all([
    db.trip.findMany({
      where: tripWhere,
      select: {
        startedAt: true,
        distanceKm: true,
        durationMs: true,
      },
    }),
    db.event.findMany({
      where: eventWhere,
      select: { occurredAt: true },
    }),
  ]);

  // Agrupar en buckets
  for (const t of trips) {
    const ts = new Date(t.startedAt).getTime();
    for (const b of buckets) {
      if (ts >= b.startUtc.getTime() && ts <= b.endUtc.getTime()) {
        b.trips += 1;
        b.distanceKm += t.distanceKm;
        b.durationMs += t.durationMs;
        break;
      }
    }
  }
  for (const e of events) {
    const ts = new Date(e.occurredAt).getTime();
    for (const b of buckets) {
      if (ts >= b.startUtc.getTime() && ts <= b.endUtc.getTime()) {
        b.events += 1;
        break;
      }
    }
  }

  const hasAny = buckets.some((b) => b.trips > 0 || b.events > 0);
  if (!hasAny) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="Sin actividad en este período"
          description="No se registraron viajes ni eventos en el rango seleccionado."
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <BarChart
        title="Distancia recorrida"
        unit="km"
        buckets={buckets}
        getValue={(b) => b.distanceKm}
        format={(n) =>
          n.toLocaleString("es-AR", { maximumFractionDigits: 0 })
        }
      />
      <BarChart
        title="Viajes"
        unit=""
        buckets={buckets}
        getValue={(b) => b.trips}
        format={(n) => n.toString()}
      />
      <BarChart
        title="Tiempo en marcha"
        unit=""
        buckets={buckets}
        getValue={(b) => b.durationMs / 60000}
        format={(n) => `${Math.round(n)} min`}
      />
      <BarChart
        title="Eventos"
        unit=""
        buckets={buckets}
        getValue={(b) => b.events}
        format={(n) => n.toString()}
        accent="warn"
      />
    </div>
  );
}

interface BarChartProps {
  title: string;
  unit: string;
  buckets: Bucket[];
  getValue: (b: Bucket) => number;
  format: (n: number) => string;
  accent?: "default" | "warn";
}

function BarChart({
  title,
  unit,
  buckets,
  getValue,
  format,
  accent = "default",
}: BarChartProps) {
  const values = buckets.map(getValue);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>{title}</h3>
        <span className={styles.chartTotal}>
          Total: {format(total)} {unit}
        </span>
      </div>
      <div className={styles.barRow}>
        {buckets.map((b, i) => {
          const v = values[i]!;
          const pct = (v / max) * 100;
          const barClass =
            accent === "warn" && v > 0
              ? styles.barWarn
              : v > 0
                ? styles.barFilled
                : styles.barEmpty;
          return (
            <div
              key={b.idx}
              className={styles.barCol}
              title={`${b.label}: ${format(v)} ${unit}`}
            >
              <div className={styles.barTrack}>
                <div
                  className={`${styles.bar} ${barClass} ${b.isToday ? styles.barToday : ""}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <div className={styles.barLabel}>{b.shortLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Bucket computation (similar to analysis.ts spec_* functions)
// ═══════════════════════════════════════════════════════════════

function computeBuckets(
  granularity: AnalysisGranularity,
  anchorIso: string,
): Bucket[] {
  const buckets: Bucket[] = [];
  const anchorMidnightUtc = new Date(anchorIso + "T03:00:00.000Z"); // 00:00 AR

  const todayLocal = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayIso = todayLocal.toISOString().slice(0, 10);

  switch (granularity) {
    case "day-hours": {
      // 24 horas del día
      for (let h = 0; h < 24; h++) {
        const start = new Date(
          anchorMidnightUtc.getTime() + h * 3600000,
        );
        const end = new Date(start.getTime() + 3600000 - 1);
        buckets.push({
          idx: h,
          shortLabel: `${h}`,
          label: `${anchorIso} ${h.toString().padStart(2, "0")}:00`,
          isToday: false,
          startUtc: start,
          endUtc: end,
          trips: 0,
          distanceKm: 0,
          durationMs: 0,
          events: 0,
        });
      }
      break;
    }
    case "week-days": {
      // Lunes a domingo
      const anchor = new Date(anchorMidnightUtc);
      const dow = anchor.getUTCDay() === 0 ? 6 : anchor.getUTCDay() - 1;
      const monday = new Date(anchor.getTime() - dow * 86400000);
      const dayShorts = ["L", "M", "M", "J", "V", "S", "D"];
      const dayLongs = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ];
      for (let d = 0; d < 7; d++) {
        const start = new Date(monday.getTime() + d * 86400000);
        const end = new Date(start.getTime() + 86400000 - 1);
        const dayIso = start.toISOString().slice(0, 10);
        buckets.push({
          idx: d,
          shortLabel: dayShorts[d]!,
          label: `${dayLongs[d]!} ${dayIso.slice(8, 10)}/${dayIso.slice(5, 7)}`,
          isToday: dayIso === todayIso,
          startUtc: start,
          endUtc: end,
          trips: 0,
          distanceKm: 0,
          durationMs: 0,
          events: 0,
        });
      }
      break;
    }
    case "month-days": {
      const year = anchorMidnightUtc.getUTCFullYear();
      const month = anchorMidnightUtc.getUTCMonth();
      const monthStart = new Date(Date.UTC(year, month, 1, 3));
      const monthEnd = new Date(Date.UTC(year, month + 1, 1, 3) - 1);
      const days = Math.floor(
        (monthEnd.getTime() - monthStart.getTime()) / 86400000,
      ) + 1;
      for (let d = 0; d < days; d++) {
        const start = new Date(monthStart.getTime() + d * 86400000);
        const end = new Date(start.getTime() + 86400000 - 1);
        const dayIso = start.toISOString().slice(0, 10);
        buckets.push({
          idx: d,
          shortLabel: `${d + 1}`,
          label: dayIso,
          isToday: dayIso === todayIso,
          startUtc: start,
          endUtc: end,
          trips: 0,
          distanceKm: 0,
          durationMs: 0,
          events: 0,
        });
      }
      break;
    }
    case "year-weeks":
    case "year-months": {
      const year = anchorMidnightUtc.getUTCFullYear();
      const monthShorts = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
      ];
      for (let m = 0; m < 12; m++) {
        const start = new Date(Date.UTC(year, m, 1, 3));
        const end = new Date(Date.UTC(year, m + 1, 1, 3) - 1);
        const todayMonth = todayLocal.getUTCMonth();
        const todayYear = todayLocal.getUTCFullYear();
        buckets.push({
          idx: m,
          shortLabel: monthShorts[m]!,
          label: `${monthShorts[m]} ${year}`,
          isToday: year === todayYear && m === todayMonth,
          startUtc: start,
          endUtc: end,
          trips: 0,
          distanceKm: 0,
          durationMs: 0,
          events: 0,
        });
      }
      break;
    }
  }

  return buckets;
}

async function resolveAssetIds(
  type: ObjectType,
  id: string,
): Promise<string[]> {
  if (type === "vehiculo") return [id];
  if (type === "conductor") {
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
