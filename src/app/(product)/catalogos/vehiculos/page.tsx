import {
  getAccountsForFilter,
  getAssetForEdit,
  getAssetStatusCounts,
  getDriversForSelect,
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
import { getSession } from "@/lib/session";
import {
  canWrite,
  canCreateEntity,
  canUpdateEntity,
  canDeleteEntity,
  getScopedAccountIds,
} from "@/lib/permissions";
import { db } from "@/lib/db";
import { AssetEditDrawer } from "./AssetEditDrawer";
import { NewAssetButton } from "./NewAssetButton";
import { AssetsBulkContainer } from "./AssetsBulkContainer";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /catalogos/vehiculos · Lista + CRUD
//  ─────────────────────────────────────────────────────────────
//  Lote A3:
//    · Tenant scoping · listAssets filtra por scopedAccountIds
//    · Botón "+ Nuevo vehículo" en header (solo si canWrite)
//    · Kebab por fila · Editar / Dar de baja
//    · Drawer abre con ?new=1 o ?edit=<id>
//
//  El drawer es server-side · cuando aparece ?edit=<id> en la URL
//  precargamos el asset desde DB y lo pasamos al componente.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssetsListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseAssetsParams(raw);

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
  // Permiso a nivel módulo (usado por el bulk container y para
  // gate genérico de "puede hacer algo de escritura")
  const userCanWrite = canWrite(session, "catalogos");

  // Permisos granulares por acción (H7a)
  const canCreateVehicle = canCreateEntity(session, "catalogos", "vehiculos");
  const canUpdateVehicle = canUpdateEntity(session, "catalogos", "vehiculos");
  const canDeleteVehicle = canDeleteEntity(session, "catalogos", "vehiculos");

  const [
    listResult,
    statusCounts,
    accounts,
    groups,
    drivers,
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
      scopedAccountIds,
    }),
    getAssetStatusCounts({ accountId: params.accountId, scopedAccountIds }),
    getAccountsForFilter(scopedAccountIds),
    getGroupsForFilter(null, scopedAccountIds),
    // Drivers cargados para drawer Y bulk toolbar (si canWrite)
    userCanWrite
      ? (async () => {
          if (Array.isArray(scopedAccountIds) && scopedAccountIds.length === 0) {
            return [];
          }
          const where = Array.isArray(scopedAccountIds)
            ? { accountId: { in: scopedAccountIds } }
            : {};
          return db.person.findMany({
            where,
            select: { id: true, firstName: true, lastName: true, accountId: true },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          });
        })()
      : Promise.resolve([] as { id: string; firstName: string; lastName: string; accountId: string }[]),
  ]);

  // Drawer data · cargo solo si está abierto y user tiene write perm
  let drawerInitial: Awaited<ReturnType<typeof getAssetForEdit>> = null;

  if (drawerMode === "edit" && editId && canUpdateVehicle) {
    drawerInitial = await getAssetForEdit(editId, scopedAccountIds);
  }

  const totalCount =
    statusCounts.MOVING +
    statusCounts.IDLE +
    statusCounts.STOPPED +
    statusCounts.OFFLINE +
    statusCounts.MAINTENANCE;

  return (
    <div className={styles.page}>
      {/* ── Header con título y acciones ─────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Vehículos</h1>
          <p className={styles.subtitle}>
            Catálogo de la flota
            {scopedAccountIds && scopedAccountIds.length === 1 && accounts[0]
              ? ` · ${accounts[0].name}`
              : ""}
          </p>
        </div>
        {canCreateVehicle && (
          <div className={styles.headerActions}>
            <NewAssetButton />
          </div>
        )}
      </div>

      {/* ── KPI Strip ────────────────────────────────────── */}
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

      {/* ── Filter bar ────────────────────────────────────── */}
      <AssetFilterBar
        current={params}
        accounts={accounts}
        groups={groups}
      />

      {/* ── Table + pagination ───────────────────────────── */}
      {userCanWrite ? (
        <AssetsBulkContainer
          rows={listResult.rows}
          current={params}
          groupOptions={groups}
          driverOptions={drivers}
          canDelete={canDeleteVehicle}
          canEdit={canUpdateVehicle}
          canBulkUpdate={canUpdateVehicle}
        />
      ) : (
        <AssetTable
          rows={listResult.rows}
          current={params}
          showActions={false}
        />
      )}

      <Pagination
        total={listResult.total}
        page={listResult.page}
        pageSize={listResult.pageSize}
        pageCount={listResult.pageCount}
        buildHref={(page) => buildAssetsHref(params, { page })}
      />

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode === "new" && canCreateVehicle && (
        <AssetEditDrawer
          initialAsset={null}
          accountOptions={accounts}
          groupOptions={groups}
          driverOptions={drivers}
        />
      )}
      {drawerMode === "edit" && canUpdateVehicle && drawerInitial && (
        <AssetEditDrawer
          initialAsset={drawerInitial}
          accountOptions={accounts}
          groupOptions={groups}
          driverOptions={drivers}
        />
      )}
    </div>
  );
}
