import {
  aggregateTripKpis,
  getTripRoutes,
  listDriversForFilter,
  listGroupsForFilter,
  listMobileAssetsForFilter,
  listTrips,
} from "@/lib/queries";
import { parseTripsParams } from "@/lib/url-trips";
import { TripsFilterBar } from "@/components/maxtracker/TripsFilterBar";
import { TripsKpiStrip } from "@/components/maxtracker/TripsKpiStrip";
import { TripsClient } from "./TripsClient";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /seguimiento/viajes
//  ─────────────────────────────────────────────────────────────
//  Cross-fleet trip listing with map overlay. Default range is
//  the last 7 days (rolling). Filters: vehicles, groups, drivers.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ViajesPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseTripsParams(raw);

  const [assets, groups, drivers, trips] = await Promise.all([
    listMobileAssetsForFilter(),
    listGroupsForFilter(),
    listDriversForFilter(),
    listTrips({
      fromDate: params.fromDate,
      toDate: params.toDate,
      assetIds: params.assetIds,
      groupIds: params.groupIds,
      personIds: params.personIds,
    }),
  ]);

  // Routes (polylines for the map) · share the same filter so
  // they're aligned with the table content
  const routes = await getTripRoutes(
    {
      fromDate: params.fromDate,
      toDate: params.toDate,
      assetIds: params.assetIds,
      groupIds: params.groupIds,
      personIds: params.personIds,
    },
    trips,
  );
  const kpis = aggregateTripKpis(trips);

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
        <TripsClient trips={trips} routes={routes} sortParams={params} />
      </div>
    </div>
  );
}
