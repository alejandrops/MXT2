import {
  getAccountsForFilter,
  getDriverCounts,
  listDrivers,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import {
  DriverFilterBar,
  DriverTable,
  KpiTile,
  Pagination,
} from "@/components/maxtracker";
import {
  buildDriversHref,
  parseDriversParams,
} from "@/lib/url-drivers";
import { formatNumber } from "@/lib/format";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /catalogos/conductores · driver listing
//  ─────────────────────────────────────────────────────────────
//  Server Component · twin of /catalogos/vehiculos:
//    · KPI strip (Total / Activos / Inactivos / Score promedio /
//      Licencias por vencer)
//    · Filter bar (search, account, status pills)
//    · Sortable table with clickable rows → conductor detail
//    · Pagination
// ═══════════════════════════════════════════════════════════════

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConductoresListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseDriversParams(raw);

  // Multi-tenant scope (U1c)
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "catalogos", params.accountId);


  const [listResult, counts, accounts] = await Promise.all([
    listDrivers({
      search: params.search,
      accountId: scopedAccountId,
      status: params.status,
      page: params.page,
      pageSize: 25,
      sortBy: params.sort,
      sortDir: params.dir,
    }),
    getDriverCounts({ accountId: scopedAccountId }),
    getAccountsForFilter(scopedAccountId),
  ]);

  return (
    <div className={styles.page}>
      {/* ── KPI strip ─────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={formatNumber(counts.total)} />
        <KpiTile
          label="Activos"
          value={formatNumber(counts.active)}
          accent="grn"
        />
        <KpiTile
          label="Inactivos"
          value={formatNumber(counts.inactive)}
          accent={counts.inactive > 0 ? "blu" : undefined}
        />
        <KpiTile
          label="Score promedio"
          value={counts.avgSafetyScore}
          accent={
            counts.avgSafetyScore >= 80
              ? "grn"
              : counts.avgSafetyScore >= 60
                ? "amb"
                : "red"
          }
        />
        <KpiTile
          label="Licencias por vencer"
          value={formatNumber(counts.licenseExpiringSoon)}
          accent={counts.licenseExpiringSoon > 0 ? "amb" : undefined}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <DriverFilterBar current={params} accounts={accounts} />

      {/* ── Table ──────────────────────────────────────────── */}
      <DriverTable rows={listResult.rows} current={params} />

      {/* ── Pagination ─────────────────────────────────────── */}
      <Pagination
        total={listResult.total}
        page={listResult.page}
        pageSize={listResult.pageSize}
        pageCount={listResult.pageCount}
        buildHref={(page) => buildDriversHref(params, { page })}
      />
    </div>
  );
}
