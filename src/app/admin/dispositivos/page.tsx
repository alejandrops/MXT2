import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getDeviceCounts,
  getDeviceForEdit,
  listAssetsForDeviceAssign,
  listDevices,
  type DeviceCommState,
  type DeviceLifecycleStatus,
  type DeviceVendor,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { DeviceEditDrawer } from "./DeviceEditDrawer";
import { DeviceActionsKebab } from "./DeviceActionsKebab";
import { AdminDevicesHeaderActions } from "./AdminDevicesHeaderActions";
import { AdminDevicesImporter } from "./AdminDevicesImporter";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/dispositivos · CRUD Devices (H2)
//  ─────────────────────────────────────────────────────────────
//  CRUD completo de dispositivos IoT · Maxtracker staff (SA, MA)
//  gestiona el inventario de trackers Teltonika/Queclink/Concox
//  con su ciclo de vida (Stock → Instalado → Reparación → Baja).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    state?: string;
    status?: string;
    vendor?: string;
    primary?: string;
    new?: string;
    edit?: string | string[];
    import?: string;
  }>;
}

const ALLOWED_COMM_STATES: DeviceCommState[] = [
  "ONLINE",
  "RECENT",
  "STALE",
  "LONG",
  "OFFLINE",
];

const ALLOWED_STATUSES: DeviceLifecycleStatus[] = [
  "STOCK",
  "INSTALLED",
  "IN_REPAIR",
  "DECOMMISSIONED",
];

const ALLOWED_VENDORS: DeviceVendor[] = [
  "TELTONIKA",
  "QUECLINK",
  "CONCOX",
  "OTHER",
];

const VENDOR_LABELS: Record<DeviceVendor, string> = {
  TELTONIKA: "Teltonika",
  QUECLINK: "Queclink",
  CONCOX: "Concox",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<DeviceLifecycleStatus, string> = {
  STOCK: "Stock",
  INSTALLED: "Instalado",
  IN_REPAIR: "Reparación",
  DECOMMISSIONED: "Baja",
};

export default async function DispositivosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const commState = ALLOWED_COMM_STATES.includes(sp.state as DeviceCommState)
    ? (sp.state as DeviceCommState)
    : null;
  const status = ALLOWED_STATUSES.includes(sp.status as DeviceLifecycleStatus)
    ? (sp.status as DeviceLifecycleStatus)
    : null;
  const vendor = ALLOWED_VENDORS.includes(sp.vendor as DeviceVendor)
    ? (sp.vendor as DeviceVendor)
    : null;
  const primaryOnly = sp.primary === "1";

  // Drawer
  const isNew = sp.new === "1";
  const isImport = sp.import === "1";
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const drawerMode: "new" | "edit" | "closed" = editId
    ? "edit"
    : isNew
      ? "new"
      : "closed";

  // Permisos
  const session = await getSession();
  if (!canRead(session, "backoffice_dispositivos")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_dispositivos");

  const [counts, listResult, assetOptions] = await Promise.all([
    getDeviceCounts(),
    listDevices({
      search,
      commState,
      status,
      vendor,
      primaryOnly,
    }),
    drawerMode !== "closed" && userCanWrite
      ? listAssetsForDeviceAssign()
      : Promise.resolve([]),
  ]);

  let drawerInitial: Awaited<ReturnType<typeof getDeviceForEdit>> = null;
  if (drawerMode === "edit" && editId && userCanWrite) {
    drawerInitial = await getDeviceForEdit(editId);
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Dispositivos</h1>
          <p className={styles.subtitle}>
            Inventario de trackers GPS · ciclo de vida y comunicación
          </p>
        </div>
        {userCanWrite && <AdminDevicesHeaderActions />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={counts.total} />
        <KpiTile label="En stock" value={counts.stock} accent="blu" />
        <KpiTile label="Instalados" value={counts.installed} accent="grn" />
        <KpiTile
          label="Reparación"
          value={counts.inRepair}
          accent={counts.inRepair > 0 ? "amb" : undefined}
        />
        <KpiTile label="Online" value={counts.online} accent="grn" />
        <KpiTile
          label="Sin señal"
          value={counts.offline}
          accent={counts.offline > 0 ? "red" : undefined}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/dispositivos">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por IMEI, serie, modelo…"
            className={styles.searchInput}
          />
        </div>

        <select
          name="status"
          defaultValue={status ?? ""}
          className={styles.select}
        >
          <option value="">Todos los estados</option>
          <option value="STOCK">En stock</option>
          <option value="INSTALLED">Instalado</option>
          <option value="IN_REPAIR">En reparación</option>
          <option value="DECOMMISSIONED">Dado de baja</option>
        </select>

        <select
          name="vendor"
          defaultValue={vendor ?? ""}
          className={styles.select}
        >
          <option value="">Todos los vendors</option>
          <option value="TELTONIKA">Teltonika</option>
          <option value="QUECLINK">Queclink</option>
          <option value="CONCOX">Concox</option>
          <option value="OTHER">Otro</option>
        </select>

        <select
          name="state"
          defaultValue={commState ?? ""}
          className={styles.select}
        >
          <option value="">Toda señal</option>
          <option value="ONLINE">Online</option>
          <option value="RECENT">Reciente</option>
          <option value="STALE">Demorado</option>
          <option value="LONG">Tardío</option>
          <option value="OFFLINE">Sin señal</option>
        </select>

        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search || commState || status || vendor || primaryOnly) && (
          <Link href="/admin/dispositivos" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────── */}
      {listResult.rows.length === 0 ? (
        <div className={styles.empty}>
          {search || commState || status || vendor || primaryOnly
            ? "No hay dispositivos que coincidan con los filtros."
            : "No hay dispositivos cargados."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>IMEI · Modelo</th>
                <th className={styles.th}>Estado</th>
                <th className={styles.th}>Vehículo</th>
                <th className={styles.th}>Señal</th>
                <th className={styles.th}>Última conexión</th>
                {userCanWrite && (
                  <th className={styles.thAction} aria-hidden="true" />
                )}
              </tr>
            </thead>
            <tbody>
              {listResult.rows.map((d) => (
                <tr
                  key={d.id}
                  className={`${styles.row} ${
                    d.status === "DECOMMISSIONED" ? styles.rowMuted : ""
                  }`}
                >
                  <td className={styles.td}>
                    <div className={styles.imeiCell}>
                      <span className={`${styles.imei} ${styles.mono}`}>
                        {d.imei}
                      </span>
                      <span className={styles.imeiSub}>
                        {VENDOR_LABELS[d.vendor]} · {d.model}
                        {d.firmwareVersion && ` · fw ${d.firmwareVersion}`}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <StatusPill status={d.status} />
                  </td>
                  <td className={styles.td}>
                    {d.asset ? (
                      <div className={styles.assetCell}>
                        <span className={styles.assetName}>
                          {d.asset.name}
                          {d.isPrimary && (
                            <span className={styles.primaryBadge}>★</span>
                          )}
                        </span>
                        <span className={styles.assetSub}>
                          {d.asset.accountName}
                          {d.asset.plate && ` · ${d.asset.plate}`}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.placeholder}>—</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {d.status === "INSTALLED" ? (
                      <CommPill state={d.commState} />
                    ) : (
                      <span className={styles.placeholder}>—</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>
                      {d.lastSeenAt
                        ? formatRelative(d.lastSeenAt)
                        : "Nunca"}
                    </span>
                  </td>
                  {userCanWrite && (
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      <DeviceActionsKebab
                        deviceId={d.id}
                        imei={d.imei}
                        status={d.status}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode !== "closed" && userCanWrite && (
        <DeviceEditDrawer
          initialDevice={drawerMode === "edit" ? drawerInitial : null}
          assetOptions={assetOptions}
        />
      )}

      {/* ── Importer drawer ──────────────────────────────── */}
      {isImport && userCanWrite && <AdminDevicesImporter />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

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
                : accent === "blu"
                  ? styles.kpiAccentBlu
                  : ""
        }`}
      >
        {value.toLocaleString("es-AR")}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: DeviceLifecycleStatus }) {
  const cls =
    status === "INSTALLED"
      ? styles.statusInstalled
      : status === "STOCK"
        ? styles.statusStock
        : status === "IN_REPAIR"
          ? styles.statusRepair
          : styles.statusDecommissioned;
  return (
    <span className={`${styles.statusPill} ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function CommPill({ state }: { state: DeviceCommState }) {
  const cls =
    state === "ONLINE"
      ? styles.commOnline
      : state === "RECENT"
        ? styles.commRecent
        : state === "STALE"
          ? styles.commStale
          : state === "LONG"
            ? styles.commLong
            : styles.commOffline;
  const label =
    state === "ONLINE"
      ? "Online"
      : state === "RECENT"
        ? "Reciente"
        : state === "STALE"
          ? "Demorado"
          : state === "LONG"
            ? "Tardío"
            : "Sin señal";
  return <span className={`${styles.commPill} ${cls}`}>{label}</span>;
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / (60 * 1000));
  const h = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  if (h < 24) return `hace ${h} h`;
  if (days < 30) return `hace ${days} d`;
  const day = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mo}/${d.getFullYear()}`;
}
