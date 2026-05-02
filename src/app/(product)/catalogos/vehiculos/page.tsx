import {
  getAccountsForFilter,
  getGroupsForFilter,
  listAssets,
} from "@/lib/queries";
import { getFleetStatusDistribution } from "@/lib/queries/fleet-metrics";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  AssetFilterBar,
  AssetTable,
  KpiTile,
  Pagination,
} from "@/components/maxtracker";
import { parseAssetsParams, buildAssetsHref } from "@/lib/url";
import { formatNumber } from "@/lib/format";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Catálogos / Vehículos · Lista (Patrón A)
//  ─────────────────────────────────────────────────────────────
//  Server Component que consume searchParams para filtros, sort y
//  paginación.
//
//  Multi-tenant scoping (U1):
//   · El accountId que va al query NO se toma directo del search-
//     Param · pasa por resolveAccountScope, que para users con
//     scope OWN_ACCOUNT (CA, OP) fuerza al accountId del session.
//   · Para users cross-account (SA, MA) respeta el filtro de la UI.
//
//  Status distribution (L2B-1):
//   · Usa fleet-metrics.getFleetStatusDistribution() · deriva estado
//     de LivePosition (no del Asset.status denormalizado · que podía
//     estar stale si refresh-live-positions no corría).
//   · Bug B6 a nivel código resuelto · todas las pantallas que
//     muestran "estado de la flota" leen del mismo módulo.
//
//  Layout:
//    · KPI strip (5 status counts: Moving / Idle / Stopped /
//      Offline / Maintenance) + total
//    · FilterBar (search, account [solo cross-account], group,
//      status, mobility)
//    · Table (sortable headers, clickable rows)
//    · Pagination footer
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssetsListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseAssetsParams(raw);

  // Tenant scoping · forzar accountId del user si tiene scope OWN_ACCOUNT
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(
    session,
    "catalogos",
    params.accountId,
  );

  const [
    listResult,
    statusCounts,
    accounts,
    groups,
  ] = await Promise.all([
    listAssets({
      search: params.search,
      accountId: scopedAccountId,
      groupId: params.groupId,
      status: params.status,
      mobility: params.mobility,
      page: params.page,
      pageSize: 25,
      sortBy: params.sort,
      sortDir: params.dir,
    }),
    // L2B-1 · `getFleetStatusDistribution` reemplaza al previo
    // `getAssetStatusCounts` · deriva de LivePosition vía deriveAssetState.
    getFleetStatusDistribution({ accountId: scopedAccountId }),
    getAccountsForFilter(),
    getGroupsForFilter(),
  ]);

  return (
    <div className={styles.page}>
      {/* ── KPI Strip · status distribution ────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={formatNumber(statusCounts.total)} />
        <KpiTile
          label="En movimiento"
          value={statusCounts.MOVING}
          accent="grn"
        />
        <KpiTile label="Detenidos" value={statusCounts.IDLE} accent="blu" />
        <KpiTile
          label="Sin señal"
          value={statusCounts.OFFLINE}
          accent={statusCounts.OFFLINE > 0 ? "red" : undefined}
        />
        <KpiTile
          label="Mantenimiento"
          value={statusCounts.MAINTENANCE}
          accent={statusCounts.MAINTENANCE > 0 ? "amb" : undefined}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <AssetFilterBar
        current={params}
        accounts={accounts}
        groups={groups}
      />

      {/* ── Table + pagination ─────────────────────────────── */}
      <AssetTable rows={listResult.rows} current={params} />

      <Pagination
        total={listResult.total}
        page={listResult.page}
        pageSize={listResult.pageSize}
        pageCount={listResult.pageCount}
        buildHref={(page) => buildAssetsHref(params, { page })}
      />
    </div>
  );
}
