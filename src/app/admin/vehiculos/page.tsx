import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getAdminAssetCounts,
  getAssetDetailForAdmin,
  listAssetsForAdmin,
  getAccountsForFilter,
  type AdminAssetVehicleType,
} from "@/lib/queries";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { AdminAssetDrawer } from "./AdminAssetDrawer";
import { AdminVehiclesImporter } from "./AdminVehiclesImporter";
import { AdminVehiclesHeaderActions } from "./AdminVehiclesHeaderActions";
import { AdminVehiclesBulkContainer } from "./AdminVehiclesBulkContainer";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/vehiculos · Backoffice cross-cliente (H7c)
//  ─────────────────────────────────────────────────────────────
//  Maxtracker staff (SA, MA) gestiona vehículos de TODAS las
//  cuentas. Drawer técnico con secciones para device, sim,
//  accesorios y comandos.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    account?: string;
    type?: string;
    vendor?: string;
    deviceStatus?: string;
    noDevice?: string;
    page?: string;
    edit?: string | string[];
    import?: string;
  }>;
}

const VEHICLE_TYPE_LABELS: Record<AdminAssetVehicleType, string> = {
  GENERIC: "Genérico",
  CAR: "Auto",
  TRUCK: "Camión",
  MOTORCYCLE: "Moto",
  HEAVY_MACHINERY: "Maquinaria",
  TRAILER: "Trailer",
  SILO: "Silo",
};

const VENDOR_LABELS: Record<string, string> = {
  TELTONIKA: "Teltonika",
  QUECLINK: "Queclink",
  CONCOX: "Concox",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  STOCK: "Stock",
  INSTALLED: "Instalado",
  IN_REPAIR: "Reparación",
  DECOMMISSIONED: "Baja",
};

export default async function AdminVehiculosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const accountId =
    typeof sp.account === "string" && sp.account.trim() ? sp.account : null;
  const vehicleType =
    typeof sp.type === "string" &&
    Object.keys(VEHICLE_TYPE_LABELS).includes(sp.type)
      ? (sp.type as AdminAssetVehicleType)
      : null;
  const deviceVendor =
    typeof sp.vendor === "string" && Object.keys(VENDOR_LABELS).includes(sp.vendor)
      ? sp.vendor
      : null;
  const deviceStatus =
    typeof sp.deviceStatus === "string" &&
    Object.keys(STATUS_LABELS).includes(sp.deviceStatus)
      ? sp.deviceStatus
      : null;
  const withoutDevice = sp.noDevice === "1";
  const page = sp.page ? Math.max(1, parseInt(sp.page as string, 10) || 1) : 1;

  // Drawer + Import
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const isImport = sp.import === "1";

  // Permisos
  const session = await getSession();
  if (!canRead(session, "backoffice_vehiculos")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_vehiculos");

  const [counts, listResult, accounts] = await Promise.all([
    getAdminAssetCounts(),
    listAssetsForAdmin({
      search,
      accountId,
      vehicleType,
      deviceVendor,
      deviceStatus,
      withoutDevice,
      page,
      pageSize: 50,
    }),
    getAccountsForFilter(),
  ]);

  let drawerInitial: Awaited<ReturnType<typeof getAssetDetailForAdmin>> = null;
  let drawerGroups: { id: string; name: string; accountId: string }[] = [];
  let drawerDrivers: {
    id: string;
    firstName: string;
    lastName: string;
    accountId: string;
  }[] = [];
  if (editId && userCanWrite) {
    drawerInitial = await getAssetDetailForAdmin(editId);
    if (drawerInitial) {
      // Cargar TODOS los groups y drivers cross-cliente · el form
      // permite cambiar de cliente, y al hacerlo el cliente filtra
      // localmente por el accountId del nuevo cliente. Si solo
      // cargáramos los del account original, al cambiar de cliente
      // los selects quedarían vacíos.
      const [groups, drivers] = await Promise.all([
        db.group.findMany({
          select: { id: true, name: true, accountId: true },
          orderBy: [{ accountId: "asc" }, { name: "asc" }],
        }),
        db.person.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            accountId: true,
          },
          orderBy: [
            { accountId: "asc" },
            { firstName: "asc" },
            { lastName: "asc" },
          ],
        }),
      ]);
      drawerGroups = groups;
      drawerDrivers = drivers;
    }
  }

  const totalPages = Math.ceil(listResult.total / 50);

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Vehículos</h1>
          <p className={styles.subtitle}>
            Gestión técnica cross-cliente · {counts.total.toLocaleString("es-AR")}{" "}
            vehículos en {accounts.length}{" "}
            {accounts.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        {userCanWrite && <AdminVehiclesHeaderActions />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={counts.total} />
        <KpiTile label="Con device" value={counts.withDevice} accent="grn" />
        <KpiTile
          label="Sin device"
          value={counts.withoutDevice}
          accent={counts.withoutDevice > 0 ? "amb" : undefined}
        />
        <KpiTile
          label="Con device sin SIM"
          value={counts.withoutSim}
          accent={counts.withoutSim > 0 ? "red" : undefined}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/vehiculos">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por nombre, patente, VIN…"
            className={styles.searchInput}
          />
        </div>

        <select
          name="account"
          defaultValue={accountId ?? ""}
          className={styles.select}
        >
          <option value="">Todos los clientes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          name="type"
          defaultValue={vehicleType ?? ""}
          className={styles.select}
        >
          <option value="">Todos los tipos</option>
          {(Object.keys(VEHICLE_TYPE_LABELS) as AdminAssetVehicleType[]).map(
            (k) => (
              <option key={k} value={k}>
                {VEHICLE_TYPE_LABELS[k]}
              </option>
            ),
          )}
        </select>

        <select
          name="vendor"
          defaultValue={deviceVendor ?? ""}
          className={styles.select}
        >
          <option value="">Todos los vendors</option>
          {Object.keys(VENDOR_LABELS).map((k) => (
            <option key={k} value={k}>
              {VENDOR_LABELS[k]}
            </option>
          ))}
        </select>

        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search ||
          accountId ||
          vehicleType ||
          deviceVendor ||
          deviceStatus ||
          withoutDevice) && (
          <Link href="/admin/vehiculos" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────── */}
      {listResult.rows.length === 0 ? (
        <div className={styles.empty}>
          {search || accountId || vehicleType || deviceVendor
            ? "No hay vehículos que coincidan con los filtros."
            : "No hay vehículos cargados."}
        </div>
      ) : userCanWrite ? (
        <AdminVehiclesBulkContainer
          rows={listResult.rows}
          userCanWrite={userCanWrite}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Vehículo · Patente</th>
                <th className={styles.th}>Cliente</th>
                <th className={styles.th}>Tipo</th>
                <th className={styles.th}>Device</th>
                <th className={styles.th}>SIM</th>
              </tr>
            </thead>
            <tbody>
              {listResult.rows.map((a) => (
                <tr key={a.id} className={styles.row}>
                  <td className={styles.td}>
                    <div className={styles.assetCell}>
                      <span className={styles.assetName}>{a.name}</span>
                      <span className={styles.assetSub}>
                        {a.plate ? (
                          <span className={styles.mono}>{a.plate}</span>
                        ) : (
                          <span className={styles.placeholder}>sin patente</span>
                        )}
                        {a.make && ` · ${a.make}${a.model ? ` ${a.model}` : ""}`}
                        {a.year && ` · ${a.year}`}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>{a.account.name}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.typeChip}>
                      {VEHICLE_TYPE_LABELS[a.vehicleType]}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {a.device ? (
                      <div className={styles.deviceCell}>
                        <span className={`${styles.mono} ${styles.deviceImei}`}>
                          {a.device.imei}
                        </span>
                        <span className={styles.deviceSub}>
                          {VENDOR_LABELS[a.device.vendor] ?? a.device.vendor}{" "}
                          · {a.device.model}
                          {a.device.firmwareVersion &&
                            ` · fw ${a.device.firmwareVersion}`}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.warningChip}>Sin device</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {a.sim ? (
                      <div className={styles.simCell}>
                        <span className={`${styles.mono} ${styles.simIccid}`}>
                          {a.sim.iccid.slice(-8)}
                        </span>
                        <span className={styles.simSub}>
                          {a.sim.carrier}
                          {a.sim.phoneNumber && ` · ${a.sim.phoneNumber}`}
                        </span>
                      </div>
                    ) : a.device ? (
                      <span className={styles.warningChip}>Sin SIM</span>
                    ) : (
                      <span className={styles.placeholder}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Página {page} de {totalPages} ·{" "}
            {listResult.total.toLocaleString("es-AR")} resultados
          </span>
          <div className={styles.pageButtons}>
            {page > 1 && (
              <Link
                href={buildPageHref(sp, page - 1)}
                className={styles.pageBtn}
              >
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageHref(sp, page + 1)}
                className={styles.pageBtn}
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {editId && drawerInitial && userCanWrite && (
        <AdminAssetDrawer
          asset={drawerInitial}
          accountOptions={accounts}
          groupOptions={drawerGroups}
          driverOptions={drawerDrivers}
        />
      )}

      {/* ── Importer drawer ──────────────────────────────── */}
      {isImport && userCanWrite && <AdminVehiclesImporter />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function buildPageHref(
  sp: Record<string, string | string[] | undefined>,
  newPage: number,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    if (typeof v === "string" && v.length > 0) params.set(k, v);
  }
  if (newPage > 1) params.set("page", String(newPage));
  const qs = params.toString();
  return qs ? `/admin/vehiculos?${qs}` : "/admin/vehiculos";
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "grn" | "amb" | "red" | "blu";
}) {
  return (
    <div className={styles.kpiTile}>
      <span className={styles.kpiLabel}>{label}</span>
      <span
        className={`${styles.kpiValue} ${
          accent === "grn"
            ? styles.kpiAccentGrn
            : accent === "amb"
              ? styles.kpiAccentAmb
              : accent === "red"
                ? styles.kpiAccentRed
                : ""
        }`}
      >
        {value.toLocaleString("es-AR")}
      </span>
    </div>
  );
}
