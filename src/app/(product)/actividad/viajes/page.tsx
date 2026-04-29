import {
  aggregateTripKpis,
  listDriversForFilter,
  listGroupsForFilter,
  listMobileAssetsForFilter,
  listTrips,
} from "@/lib/queries";
import { listTripsAndStopsByDay } from "@/lib/queries/trips-by-day";
import { parseTripsParams } from "@/lib/url-trips";
import { TripsFilterBar } from "@/components/maxtracker/TripsFilterBar";
import { TripsKpiStrip } from "@/components/maxtracker/TripsKpiStrip";
import { TripsClient } from "./TripsClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /actividad/viajes · vista "Día por día"
//  ─────────────────────────────────────────────────────────────
//  Listado protagonista agrupado por (asset, día) · cada día con
//  trips y paradas intercalados. Mapa subordinado a la derecha,
//  panel lateral con detalle al hacer click.
//
//  Default range · últimos 7 días.
//  Filtros · vehículos, grupos, conductores.
//
//  CAP · para evitar render gigante cuando se filtra "todos los
//  vehículos · 7 días" (puede dar 100+ tarjetas), aplicamos un
//  cap de 20 por defecto. El usuario puede pedir "Ver más" con
//  ?cap=N (la URL se actualiza · es shareable).
//
//  Mantenemos también listTrips() para alimentar el TripsKpiStrip
//  (mismas métricas agregadas que antes · totales del período).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const DEFAULT_CAP = 20;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ViajesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseTripsParams(raw);

  // Cap de tarjetas · viene de ?cap= o default 20
  const capRaw = raw.cap;
  const capFirst = Array.isArray(capRaw) ? capRaw[0] : capRaw;
  const capParsed = capFirst ? parseInt(capFirst, 10) : DEFAULT_CAP;
  const cap = Number.isFinite(capParsed) && capParsed > 0
    ? capParsed
    : DEFAULT_CAP;

  const [assets, groups, drivers, allDays, tripsForKpis] = await Promise.all([
    listMobileAssetsForFilter(),
    listGroupsForFilter(),
    listDriversForFilter(),
    listTripsAndStopsByDay({
      fromDate: params.fromDate,
      toDate: params.toDate,
      assetIds: params.assetIds,
      groupIds: params.groupIds,
      personIds: params.personIds,
    }),
    listTrips({
      fromDate: params.fromDate,
      toDate: params.toDate,
      assetIds: params.assetIds,
      groupIds: params.groupIds,
      personIds: params.personIds,
    }),
  ]);

  const totalDays = allDays.length;
  const days = allDays.slice(0, cap);

  const kpis = aggregateTripKpis(tripsForKpis);

  return (
    <div className={styles.page}>
      <TripsFilterBar
        current={params}
        assets={assets}
        groups={groups}
        drivers={drivers}
      />

      <TripsKpiStrip kpis={kpis} />

      <div className={styles.bodyWrap}>
        <TripsClient
          days={days}
          totalDays={totalDays}
          currentCap={cap}
        />
      </div>
    </div>
  );
}
