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
//  /actividad/viajes · vista B1 · tabla densa por (día, asset)
//  ─────────────────────────────────────────────────────────────
//  Una fila por (asset, día). Click en fila abre panel lateral
//  con timeline cronológica de trips y paradas.
//
//  Default range · últimos 7 días.
//  Cap default · 100 filas (con tabla son livianas).
//  Filtros · vehículos, grupos, conductores.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const DEFAULT_CAP = 100;
const CAP_STEP = 100;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ViajesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseTripsParams(raw);

  // Cap de filas · viene de ?cap= o default 100
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
          capStep={CAP_STEP}
        />
      </div>
    </div>
  );
}
