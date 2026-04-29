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
import { canWrite, getScopedAccountIds } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AssetEditDrawer } from "./AssetEditDrawer";
import { NewAssetButton } from "./NewAssetButton";
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
  const userCanWrite = canWrite(session, "catalogos");

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
      scopedAccountIds,
    }),
    getAssetStatusCounts({ accountId: params.accountId, scopedAccountIds }),
    getAccountsForFilter(scopedAccountIds),
    getGroupsForFilter(null, scopedAccountIds),
  ]);

  // Drawer data · cargo solo si está abierto y user tiene write perm
  let drawerInitial: Awaited<ReturnType<typeof getAssetForEdit>> = null;
  let drawerDrivers: { id: string; firstName: string; lastName: string; accountId: string }[] = [];

  if (drawerMode !== "closed" && userCanWrite) {
    if (drawerMode === "edit" && editId) {
      drawerInitial = await getAssetForEdit(editId, scopedAccountIds);
    }
    // Cargar drivers de TODOS los accounts del scope · drawer filtra
    // cliente-side al cambiar selectbox de cliente
    const accountIdsForDrivers = scopedAccountIds ?? accounts.map((a) => a.id);
    drawerDrivers = await db.person.findMany({
      where: { accountId: { in: accountIdsForDrivers } },
      select: { id: true, firstName: true, lastName: true, accountId: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  const totalCount =
    statusCounts.MOVING +
    statusCounts.IDLE +
    statusCounts.STOPPED +
    statusCounts.OFFLINE +
    statusCounts.MAINTENANCE;

  return (
    <div className={styles.page}>
      {/* ── Header con título y botón "+ Nuevo" ─────────────── */}
      {userCanWrite && (
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
          <NewAssetButton />
        </div>
      )}

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
      <AssetTable
        rows={listResult.rows}
        current={params}
        showActions={userCanWrite}
      />

      <Pagination
        total={listResult.total}
        page={listResult.page}
        pageSize={listResult.pageSize}
        pageCount={listResult.pageCount}
        buildHref={(page) => buildAssetsHref(params, { page })}
      />

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode !== "closed" && userCanWrite && (
        <AssetEditDrawer
          initialAsset={drawerMode === "edit" ? drawerInitial : null}
          accountOptions={accounts}
          groupOptions={groups}
          driverOptions={drawerDrivers}
        />
      )}
    </div>
  );
}
