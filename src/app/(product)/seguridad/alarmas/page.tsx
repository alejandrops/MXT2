import {
  getAccountsForFilter,
  getAlarmCountsByStatus,
  listAlarms,
} from "@/lib/queries";
import { AlarmCard, AlarmFilterBar, KpiTile, Pagination } from "@/components/maxtracker";
import { parseAlarmsParams, buildAlarmsHref } from "@/lib/url-alarms";
import { formatNumber } from "@/lib/format";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Seguridad / Alarmas · Bandeja (Sub-lote 3.1)
//  ─────────────────────────────────────────────────────────────
//  Inbox-style cross-asset list of alarms. Mirrors the pattern of
//  Patrón A (Lista de Assets) but with alarm-specific filters.
//
//  Layout:
//    · KPI strip (4 status counts: Open / Attended / Closed /
//      Dismissed)
//    · FilterBar (search, status, severity, type, account)
//    · Vertical list of AlarmCards (25/page)
//    · Pagination footer
//
//  All state lives in URL searchParams (ADR-003). The KPI strip
//  reflects the **current account filter** (if any) so the
//  totals are coherent with what's visible below.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AlarmasInboxPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseAlarmsParams(raw);

  const [listResult, statusCounts, accounts] = await Promise.all([
    listAlarms({
      search: params.search,
      status: params.status,
      severity: params.severity,
      type: params.type,
      accountId: params.accountId,
      page: params.page,
      pageSize: 25,
      sortBy: params.sort,
      sortDir: params.dir,
    }),
    getAlarmCountsByStatus({ accountId: params.accountId }),
    getAccountsForFilter(),
  ]);

  const totalAll =
    statusCounts.OPEN +
    statusCounts.ATTENDED +
    statusCounts.CLOSED +
    statusCounts.DISMISSED;

  return (
    <div className={styles.page}>
      {/* ── KPI strip ───────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile
          label="ABIERTAS"
          value={formatNumber(statusCounts.OPEN)}
          accent={statusCounts.OPEN > 0 ? "red" : "grn"}
          caption={statusCounts.OPEN > 0 ? "Requieren atención" : "Todo en orden"}
        />
        <KpiTile
          label="ATENDIDAS"
          value={formatNumber(statusCounts.ATTENDED)}
          accent="amb"
          caption="En curso"
        />
        <KpiTile
          label="CERRADAS"
          value={formatNumber(statusCounts.CLOSED)}
          caption="Resueltas"
        />
        <KpiTile
          label="DESCARTADAS"
          value={formatNumber(statusCounts.DISMISSED)}
          caption="Falsos positivos"
        />
      </div>

      {/* ── Filter bar ──────────────────────────────────────── */}
      <AlarmFilterBar current={params} accounts={accounts} />

      {/* ── List ────────────────────────────────────────────── */}
      {listResult.rows.length === 0 ? (
        <div className={styles.empty}>
          No hay alarmas que cumplan los filtros aplicados.
        </div>
      ) : (
        <div className={styles.list}>
          {listResult.rows.map((alarm) => (
            <AlarmCard key={alarm.id} alarm={alarm} />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {listResult.total > 0 && (
        <Pagination
          total={listResult.total}
          page={listResult.page}
          pageSize={listResult.pageSize}
          pageCount={listResult.pageCount}
          buildHref={(page) => buildAlarmsHref(params, { page })}
        />
      )}
    </div>
  );
}
