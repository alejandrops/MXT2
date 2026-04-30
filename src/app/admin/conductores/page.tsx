import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getAdminDriverCounts,
  listDriversForAdmin,
  getDriverDetailForAdmin,
  getAccountsForFilter,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { AdminDriverDrawer } from "./AdminDriverDrawer";
import { AdminDriversImporter } from "./AdminDriversImporter";
import { AdminDriversHeaderActions } from "./AdminDriversHeaderActions";
import { AdminDriversBulkContainer } from "./AdminDriversBulkContainer";
import { DeleteAllDriversDialog } from "./DeleteAllDriversDialog";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/conductores · Backoffice cross-cliente (H7d)
//  ─────────────────────────────────────────────────────────────
//  Maxtracker staff (SA, MA) gestiona conductores de TODAS las
//  cuentas. Drawer editable con secciones de identificación,
//  comercial, licencia, asignaciones (read-only) y performance.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    account?: string;
    assignment?: string;
    license?: string;
    page?: string;
    edit?: string | string[];
    import?: string;
  }>;
}

const ASSIGNMENT_LABELS: Record<string, string> = {
  with: "Con vehículo asignado",
  without: "Sin asignar",
};

const LICENSE_LABELS: Record<string, string> = {
  ok: "Vigente",
  expiring_soon: "Vence pronto (<30d)",
  expired: "Vencida",
  unknown: "Sin registro",
};

export default async function AdminConductoresPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const accountId =
    typeof sp.account === "string" && sp.account.trim() ? sp.account : null;
  const assignmentFilter =
    sp.assignment === "with" || sp.assignment === "without"
      ? (sp.assignment as "with" | "without")
      : null;
  const licenseFilter =
    sp.license === "ok" ||
    sp.license === "expiring_soon" ||
    sp.license === "expired" ||
    sp.license === "unknown"
      ? (sp.license as "ok" | "expiring_soon" | "expired" | "unknown")
      : null;
  const page = sp.page ? Math.max(1, parseInt(sp.page as string, 10) || 1) : 1;

  // Drawer + import
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const isImport = sp.import === "1";

  // Permisos
  const session = await getSession();
  if (!canRead(session, "backoffice_conductores")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_conductores");

  const [counts, listResult, accounts] = await Promise.all([
    getAdminDriverCounts(),
    listDriversForAdmin({
      search,
      accountId,
      assignmentFilter,
      licenseFilter,
      page,
      pageSize: 50,
    }),
    getAccountsForFilter(),
  ]);

  let drawerInitial: Awaited<ReturnType<typeof getDriverDetailForAdmin>> = null;
  if (editId && userCanWrite) {
    drawerInitial = await getDriverDetailForAdmin(editId);
  }

  const totalPages = Math.ceil(listResult.total / 50);

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Conductores</h1>
          <p className={styles.subtitle}>
            Gestión cross-cliente · {counts.total.toLocaleString("es-AR")}{" "}
            conductores en {accounts.length}{" "}
            {accounts.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        {userCanWrite && <AdminDriversHeaderActions />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={counts.total} />
        <KpiTile
          label="Con asignación"
          value={counts.withAssignment}
          accent="grn"
        />
        <KpiTile
          label="Sin asignar"
          value={counts.withoutAssignment}
          accent={counts.withoutAssignment > 0 ? "amb" : undefined}
        />
        <KpiTile
          label="Licencia vence pronto"
          value={counts.licenseExpiringSoon}
          accent={counts.licenseExpiringSoon > 0 ? "amb" : undefined}
        />
        <KpiTile
          label="Licencia vencida"
          value={counts.licenseExpired}
          accent={counts.licenseExpired > 0 ? "red" : undefined}
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/conductores">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por nombre, apellido, documento…"
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
          name="assignment"
          defaultValue={assignmentFilter ?? ""}
          className={styles.select}
        >
          <option value="">Cualquier asignación</option>
          {Object.keys(ASSIGNMENT_LABELS).map((k) => (
            <option key={k} value={k}>
              {ASSIGNMENT_LABELS[k]}
            </option>
          ))}
        </select>

        <select
          name="license"
          defaultValue={licenseFilter ?? ""}
          className={styles.select}
        >
          <option value="">Cualquier licencia</option>
          {Object.keys(LICENSE_LABELS).map((k) => (
            <option key={k} value={k}>
              {LICENSE_LABELS[k]}
            </option>
          ))}
        </select>

        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search || accountId || assignmentFilter || licenseFilter) && (
          <Link href="/admin/conductores" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Delete-all-matching · solo SA/MA y solo si hay filtros activos ── */}
      {userCanWrite &&
        (search || accountId || assignmentFilter || licenseFilter) &&
        listResult.total > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkBarLabel}>
              {listResult.total.toLocaleString("es-AR")}{" "}
              {listResult.total === 1 ? "resultado" : "resultados"} con los
              filtros aplicados
            </span>
            <DeleteAllDriversDialog
              count={listResult.total}
              filters={{
                search,
                accountId,
                assignmentFilter,
                licenseFilter,
              }}
              activeFilterChips={[
                ...(search ? [{ label: "Búsqueda", value: search }] : []),
                ...(accountId
                  ? [
                      {
                        label: "Cliente",
                        value:
                          accounts.find((a) => a.id === accountId)?.name ??
                          accountId,
                      },
                    ]
                  : []),
                ...(assignmentFilter
                  ? [
                      {
                        label: "Asignación",
                        value: ASSIGNMENT_LABELS[assignmentFilter],
                      },
                    ]
                  : []),
                ...(licenseFilter
                  ? [
                      {
                        label: "Licencia",
                        value: LICENSE_LABELS[licenseFilter],
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
          {search || accountId || assignmentFilter || licenseFilter
            ? "No hay conductores que coincidan con los filtros."
            : "No hay conductores cargados."}
        </div>
      ) : (
        <AdminDriversBulkContainer
          rows={listResult.rows}
          userCanWrite={userCanWrite}
        />
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
        <AdminDriverDrawer
          driver={drawerInitial}
          accountOptions={accounts}
        />
      )}

      {/* ── Importer drawer ──────────────────────────────── */}
      {isImport && userCanWrite && <AdminDriversImporter />}
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
  return qs ? `/admin/conductores?${qs}` : "/admin/conductores";
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
