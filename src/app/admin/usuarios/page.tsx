import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getAccountsForFilter,
  getUserCounts,
  getUserForEdit,
  listProfilesForSelect,
  listUsers,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite, getScopedAccountIds } from "@/lib/permissions";
import { UserEditDrawer } from "./UserEditDrawer";
import { UsersTable } from "./UsersTable";
import { NewUserButton } from "./NewUserButton";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/usuarios · CRUD usuarios del backoffice (B1)
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    cliente?: string;
    perfil?: string;
    estado?: string;
    page?: string;
    new?: string;
    edit?: string | string[];
  }>;
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const filterAccountId = typeof sp.cliente === "string" && sp.cliente ? sp.cliente : null;
  const filterProfile = typeof sp.perfil === "string" && sp.perfil ? sp.perfil : null;
  const filterStatus =
    sp.estado === "ACTIVE" || sp.estado === "SUSPENDED" ? sp.estado : null;
  const page = Number(sp.page) || 1;

  // Drawer
  const isNew = sp.new === "1";
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const drawerMode: "new" | "edit" | "closed" = editId
    ? "edit"
    : isNew
      ? "new"
      : "closed";

  // Sesión y permisos
  const session = await getSession();
  if (!canRead(session, "backoffice_usuarios")) {
    // Sin permisos · redirigir a admin dashboard
    redirect("/admin");
  }
  const scopedAccountIds = getScopedAccountIds(session, "backoffice_usuarios");
  const userCanWrite = canWrite(session, "backoffice_usuarios");

  const [listResult, counts, accounts, profiles] = await Promise.all([
    listUsers({
      search,
      accountId: filterAccountId,
      profileSystemKey: filterProfile,
      status: filterStatus,
      page,
      pageSize: 25,
      scopedAccountIds,
    }),
    getUserCounts({ scopedAccountIds }),
    getAccountsForFilter(scopedAccountIds),
    listProfilesForSelect(),
  ]);

  // Drawer data
  let drawerInitial: Awaited<ReturnType<typeof getUserForEdit>> = null;
  if (drawerMode === "edit" && editId && userCanWrite) {
    drawerInitial = await getUserForEdit(editId, scopedAccountIds);
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>
            Gestión de usuarios del backoffice
            {scopedAccountIds && scopedAccountIds.length === 1 && accounts[0]
              ? ` · ${accounts[0].name}`
              : ""}
          </p>
        </div>
        {userCanWrite && <NewUserButton />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Total" value={counts.total} />
        <KpiTile label="Activos" value={counts.active} accent="grn" />
        <KpiTile
          label="Suspendidos"
          value={counts.suspended}
          accent={counts.suspended > 0 ? "amb" : undefined}
        />
        <KpiTile
          label="Admins"
          value={counts.superAdmin + counts.maxtrackerAdmin + counts.clientAdmin}
        />
        <KpiTile label="Operadores" value={counts.operator} />
      </div>

      {/* ── Filter bar ────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/usuarios">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por nombre, email o documento…"
            className={styles.searchInput}
          />
        </div>

        {accounts.length > 1 && (
          <select
            name="cliente"
            defaultValue={filterAccountId ?? ""}
            className={styles.select}
          >
            <option value="">Todos los clientes</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}

        <select
          name="perfil"
          defaultValue={filterProfile ?? ""}
          className={styles.select}
        >
          <option value="">Todos los perfiles</option>
          <option value="SUPER_ADMIN">Super admin</option>
          <option value="MAXTRACKER_ADMIN">Admin Maxtracker</option>
          <option value="CLIENT_ADMIN">Admin de cliente</option>
          <option value="OPERATOR">Operador</option>
        </select>

        <select
          name="estado"
          defaultValue={filterStatus ?? ""}
          className={styles.select}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="SUSPENDED">Suspendidos</option>
        </select>

        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>

        {(search || filterAccountId || filterProfile || filterStatus) && (
          <Link href="/admin/usuarios" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Tabla ──────────────────────────────────────────── */}
      <UsersTable
        rows={listResult.rows}
        currentUserId={session.user.id}
        canWrite={userCanWrite}
      />

      {/* ── Pagination simple ─────────────────────────────── */}
      {listResult.pageCount > 1 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Página {listResult.page} de {listResult.pageCount} · {listResult.total} usuarios
          </span>
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode !== "closed" && userCanWrite && (
        <UserEditDrawer
          initialUser={drawerMode === "edit" ? drawerInitial : null}
          accountOptions={accounts}
          profileOptions={profiles}
          actorProfileKey={session.profile.systemKey}
          actorAccountId={session.user.accountId}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  KpiTile inline · variante oscura para el shell de admin
//  ─────────────────────────────────────────────────────────────
//  El admin shell tiene fondo oscuro · usa sus propios estilos
// ═══════════════════════════════════════════════════════════════

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "grn" | "amb" | "red";
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
