import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getSimCounts,
  getSimForEdit,
  listDevicesForSimAssign,
  listSims,
  type Carrier,
  type SimStatus,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { SimEditDrawer } from "./SimEditDrawer";
import { AdminSimsBulkContainer } from "./AdminSimsBulkContainer";
import { AdminSimsHeaderActions } from "./AdminSimsHeaderActions";
import { AdminSimsImporter } from "./AdminSimsImporter";
import { DeleteAllSimsDialog } from "./DeleteAllSimsDialog";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/sims · CRUD SIMs (H3)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    carrier?: string;
    new?: string;
    edit?: string | string[];
    import?: string;
  }>;
}

const ALLOWED_STATUSES: SimStatus[] = [
  "STOCK",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
];

const ALLOWED_CARRIERS: Carrier[] = [
  "MOVISTAR",
  "CLARO",
  "PERSONAL",
  "ENTEL",
  "OTHER",
];

const CARRIER_LABELS: Record<Carrier, string> = {
  MOVISTAR: "Movistar",
  CLARO: "Claro",
  PERSONAL: "Personal",
  ENTEL: "Entel",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<SimStatus, string> = {
  STOCK: "Stock",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

export default async function SimsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const status = ALLOWED_STATUSES.includes(sp.status as SimStatus)
    ? (sp.status as SimStatus)
    : null;
  const carrier = ALLOWED_CARRIERS.includes(sp.carrier as Carrier)
    ? (sp.carrier as Carrier)
    : null;

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
  if (!canRead(session, "backoffice_sims")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_sims");

  const [counts, listResult] = await Promise.all([
    getSimCounts(),
    listSims({ search, status, carrier }),
  ]);

  let drawerInitial: Awaited<ReturnType<typeof getSimForEdit>> = null;
  let deviceOptions: Awaited<
    ReturnType<typeof listDevicesForSimAssign>
  > = [];

  if (drawerMode !== "closed" && userCanWrite) {
    if (drawerMode === "edit" && editId) {
      drawerInitial = await getSimForEdit(editId);
    }
    deviceOptions = await listDevicesForSimAssign({
      currentSimId: drawerInitial?.id ?? null,
    });
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Líneas SIM</h1>
          <p className={styles.subtitle}>
            Catálogo de SIMs · plan, carrier y asignación a dispositivos
          </p>
        </div>
        {userCanWrite && <AdminSimsHeaderActions />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={counts.total} />
        <KpiTile label="En stock" value={counts.stock} accent="blu" />
        <KpiTile label="Activas" value={counts.active} accent="grn" />
        <KpiTile
          label="Suspendidas"
          value={counts.suspended}
          accent={counts.suspended > 0 ? "amb" : undefined}
        />
        <KpiTile label="Canceladas" value={counts.cancelled} />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/sims">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por ICCID, número o APN…"
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
          <option value="ACTIVE">Activas</option>
          <option value="SUSPENDED">Suspendidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>

        <select
          name="carrier"
          defaultValue={carrier ?? ""}
          className={styles.select}
        >
          <option value="">Todos los carriers</option>
          {ALLOWED_CARRIERS.map((c) => (
            <option key={c} value={c}>
              {CARRIER_LABELS[c]}
            </option>
          ))}
        </select>

        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search || status || carrier) && (
          <Link href="/admin/sims" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Delete-all-matching · solo SA/MA y solo si hay filtros activos ── */}
      {userCanWrite &&
        (search || status || carrier) &&
        listResult.total > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkBarLabel}>
              {listResult.total.toLocaleString("es-AR")}{" "}
              {listResult.total === 1 ? "resultado" : "resultados"} con los
              filtros aplicados
            </span>
            <DeleteAllSimsDialog
              count={listResult.total}
              filters={{ search, status, carrier }}
              activeFilterChips={[
                ...(search ? [{ label: "Búsqueda", value: search }] : []),
                ...(status
                  ? [
                      {
                        label: "Estado",
                        value: STATUS_LABELS[status] ?? status,
                      },
                    ]
                  : []),
                ...(carrier
                  ? [
                      {
                        label: "Carrier",
                        value: CARRIER_LABELS[carrier] ?? carrier,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        )}

      {/* ── Table ──────────────────────────────────────────── */}
      {listResult.rows.length === 0 ? (
        <div className={styles.empty}>
          {search || status || carrier
            ? "No hay SIMs que coincidan con los filtros."
            : "No hay SIMs cargadas."}
        </div>
      ) : (
        <AdminSimsBulkContainer
          rows={listResult.rows}
          userCanWrite={userCanWrite}
        />
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode !== "closed" && userCanWrite && (
        <SimEditDrawer
          initialSim={drawerMode === "edit" ? drawerInitial : null}
          deviceOptions={deviceOptions}
        />
      )}

      {/* ── Importer drawer ──────────────────────────────── */}
      {isImport && userCanWrite && <AdminSimsImporter />}
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

function StatusPill({ status }: { status: SimStatus }) {
  const cls =
    status === "ACTIVE"
      ? styles.statusActive
      : status === "STOCK"
        ? styles.statusStock
        : status === "SUSPENDED"
          ? styles.statusSuspended
          : styles.statusCancelled;
  return (
    <span className={`${styles.statusPill} ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatPlan(mb: number): string {
  if (mb >= 1000) {
    const gb = mb / 1000;
    return gb % 1 === 0 ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}
