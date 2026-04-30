import {
  getAccountsForFilter,
  getDriverCounts,
  getPersonForEdit,
  listDrivers,
} from "@/lib/queries";
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
import { getSession } from "@/lib/session";
import {
  canCreateEntity,
  canUpdateEntity,
  canDeleteEntity,
  getScopedAccountIds,
} from "@/lib/permissions";
import { PersonEditDrawer } from "./PersonEditDrawer";
import { NewPersonButton } from "./NewPersonButton";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /catalogos/conductores · Lista + CRUD
//  ─────────────────────────────────────────────────────────────
//  Lote A4 · gemelo de A3 sobre Person:
//    · Tenant scoping en queries
//    · Botón "+ Nuevo conductor" si canWrite
//    · Kebab Editar/Eliminar por fila
//    · Drawer ?new=1 / ?edit=<id>
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConductoresListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseDriversParams(raw);

  // Drawer flags
  const isNew = raw.new === "1";
  const editIdRaw = raw.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const drawerMode: "new" | "edit" | "closed" = editId
    ? "edit"
    : isNew
      ? "new"
      : "closed";

  // Sesión y permisos
  const session = await getSession();
  const scopedAccountIds = getScopedAccountIds(session, "catalogos");
  const canCreatePerson = canCreateEntity(session, "catalogos", "conductores");
  const canUpdatePerson = canUpdateEntity(session, "catalogos", "conductores");
  const canDeletePerson = canDeleteEntity(session, "catalogos", "conductores");

  const [listResult, counts, accounts] = await Promise.all([
    listDrivers({
      search: params.search,
      accountId: params.accountId,
      status: params.status,
      page: params.page,
      pageSize: 25,
      sortBy: params.sort,
      sortDir: params.dir,
      scopedAccountIds,
    }),
    getDriverCounts({ accountId: params.accountId, scopedAccountIds }),
    getAccountsForFilter(scopedAccountIds),
  ]);

  // Drawer data
  let drawerInitial: Awaited<ReturnType<typeof getPersonForEdit>> = null;
  if (drawerMode === "edit" && editId && canUpdatePerson) {
    drawerInitial = await getPersonForEdit(editId, scopedAccountIds);
  }

  return (
    <div className={styles.page}>
      {/* ── Header con título y botón "+ Nuevo" ─────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Conductores</h1>
          <p className={styles.subtitle}>
            Catálogo del personal operativo
            {scopedAccountIds && scopedAccountIds.length === 1 && accounts[0]
              ? ` · ${accounts[0].name}`
              : ""}
          </p>
        </div>
        {canCreatePerson && <NewPersonButton />}
      </div>

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
      <DriverTable
        rows={listResult.rows}
        current={params}
        showActions={canUpdatePerson || canDeletePerson}
        canEdit={canUpdatePerson}
        canDelete={canDeletePerson}
      />

      <Pagination
        total={listResult.total}
        page={listResult.page}
        pageSize={listResult.pageSize}
        pageCount={listResult.pageCount}
        buildHref={(page) => buildDriversHref(params, { page })}
      />

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode === "new" && canCreatePerson && (
        <PersonEditDrawer
          initialPerson={null}
          accountOptions={accounts}
        />
      )}
      {drawerMode === "edit" && canUpdatePerson && drawerInitial && (
        <PersonEditDrawer
          initialPerson={drawerInitial}
          accountOptions={accounts}
        />
      )}
    </div>
  );
}
