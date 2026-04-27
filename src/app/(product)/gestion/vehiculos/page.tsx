import {
  getAccountsForFilter,
  getAssetStatusCounts,
  getGroupsForFilter,
  listAssets,
} from "@/lib/queries";
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
//  Seguridad / Assets · Lista (Patrón A)
//  ─────────────────────────────────────────────────────────────
//  Sub-lote 1.4: Server Component that consumes searchParams
//  for all filter / sort / pagination state.
//
//  Layout:
//    · KPI strip (5 status counts: Moving / Idle / Stopped /
//      Offline / Maintenance) + total
//    · FilterBar (search, account, group, status, mobility)
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

  const [
    listResult,
    statusCounts,
    accounts,
    groups,
  ] = await Promise.all([
    listAssets({
      search: params.search,
      accountId: params.accountId,
      groupId: params.groupId,
      status: params.status,
      mobility: params.mobility,
      page: params.page,
      pageSize: 25,
      sortBy: params.sort,
      sortDir: params.dir,
    }),
    getAssetStatusCounts({ accountId: params.accountId }),
    getAccountsForFilter(),
    getGroupsForFilter(),
  ]);

  const totalCount =
    statusCounts.MOVING +
    statusCounts.IDLE +
    statusCounts.STOPPED +
    statusCounts.OFFLINE +
    statusCounts.MAINTENANCE;

  return (
    <div className={styles.page}>
      {/* ── KPI Strip · status distribution ────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={formatNumber(totalCount)} />
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
