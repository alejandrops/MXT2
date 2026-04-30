import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getAccountsForFilter,
  getGroupCounts,
  getGroupDescendantIds,
  getGroupForEdit,
  listGroupsForParentSelect,
  listGroupsWithCounts,
} from "@/lib/queries";
import { KpiTile } from "@/components/maxtracker";
import { getSession } from "@/lib/session";
import {
  canCreateEntity,
  canUpdateEntity,
  canDeleteEntity,
  getScopedAccountIds,
} from "@/lib/permissions";
import { GroupEditDrawer } from "./GroupEditDrawer";
import { GroupActionsKebab } from "./GroupActionsKebab";
import { NewGroupButton } from "./NewGroupButton";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /catalogos/grupos · Lista + CRUD jerárquico
//  ─────────────────────────────────────────────────────────────
//  Lote A5 · gemelo de A3/A4 sobre Group:
//    · Tenant scoping en queries
//    · Botón "+ Nuevo grupo" si canWrite
//    · Kebab Editar/Eliminar
//    · Drawer ?new=1 / ?edit=<id>
//    · Selectbox de "Padre" excluye el grupo actual + sus
//      descendientes (prevenir ciclo)
//
//  Sigue siendo lista plana · vista tree con padre/hijos viene
//  más adelante (Libro del Grupo ya muestra el subtree).
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    new?: string;
    edit?: string | string[];
  }>;
}

export default async function GruposPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;

  // Drawer flags
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
  const scopedAccountIds = getScopedAccountIds(session, "catalogos");
  const canCreateGroup = canCreateEntity(session, "catalogos", "grupos");
  const canUpdateGroup = canUpdateEntity(session, "catalogos", "grupos");
  const canDeleteGroup = canDeleteEntity(session, "catalogos", "grupos");

  const [counts, rows, accounts] = await Promise.all([
    getGroupCounts(scopedAccountIds),
    listGroupsWithCounts({ search, scopedAccountIds }),
    getAccountsForFilter(scopedAccountIds),
  ]);

  // Drawer · cargar datos solo si está abierto y user tiene el permiso
  // específico (canCreate para new · canUpdate para edit)
  let drawerInitial: Awaited<ReturnType<typeof getGroupForEdit>> = null;
  let parentOptions: {
    id: string;
    name: string;
    accountId: string;
    parentName: string | null;
  }[] = [];

  const drawerOpen =
    (drawerMode === "new" && canCreateGroup) ||
    (drawerMode === "edit" && canUpdateGroup);

  if (drawerOpen) {
    if (drawerMode === "edit" && editId) {
      drawerInitial = await getGroupForEdit(editId, scopedAccountIds);
    }

    // Cargar parents elegibles · uno por cada account del scope
    // En modo edit, excluir el grupo actual + sus descendientes
    const accountIds = scopedAccountIds ?? accounts.map((a) => a.id);
    const excludeIds: string[] = [];
    if (drawerInitial) {
      excludeIds.push(drawerInitial.id);
      const descs = await getGroupDescendantIds(drawerInitial.id);
      excludeIds.push(...descs);
    }

    const allParents = await Promise.all(
      accountIds.map(async (accId) => {
        const list = await listGroupsForParentSelect(accId, excludeIds);
        return list.map((g) => ({ ...g, accountId: accId }));
      }),
    );
    parentOptions = allParents.flat();
  }

  return (
    <div className={styles.page}>
      {/* ── Header con título y botón "+ Nuevo" ─────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Grupos</h1>
          <p className={styles.subtitle}>
            Organización jerárquica de la flota
            {scopedAccountIds && scopedAccountIds.length === 1 && accounts[0]
              ? ` · ${accounts[0].name}`
              : ""}
          </p>
        </div>
        {canCreateGroup && <NewGroupButton />}
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Grupos totales" value={counts.totalGroups} />
        <KpiTile label="Grupos raíz" value={counts.totalRoots} />
        <KpiTile label="Vehículos asignados" value={counts.totalVehicles} />
      </div>

      {/* ── Search bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/catalogos/grupos">
        <input
          name="q"
          type="search"
          defaultValue={search ?? ""}
          placeholder="Buscar grupo por nombre…"
          className={styles.searchInput}
        />
        {search && (
          <Link href="/catalogos/grupos" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search
            ? `No hay grupos que coincidan con "${search}".`
            : "No hay grupos cargados."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Grupo</th>
                <th className={styles.th}>Cuenta</th>
                <th className={styles.th}>Padre</th>
                <th className={`${styles.th} ${styles.thRight}`}>
                  Vehículos
                </th>
                <th className={`${styles.th} ${styles.thRight}`}>
                  Subgrupos
                </th>
                <th className={styles.thAction} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const href = `/objeto/grupo/${encodeURIComponent(g.id)}`;
                return (
                  <tr key={g.id} className={styles.row}>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <span className={styles.groupName}>{g.name}</span>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        <span className={styles.dim}>{g.accountName}</span>
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <Link href={href} className={styles.cellLink}>
                        {g.parentName ? (
                          <span className={styles.dim}>{g.parentName}</span>
                        ) : (
                          <span className={styles.placeholder}>—</span>
                        )}
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdRight}`}>
                      <Link href={href} className={styles.cellLink}>
                        <span className={styles.count}>{g.vehicleCount}</span>
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdRight}`}>
                      <Link href={href} className={styles.cellLink}>
                        <span
                          className={
                            g.childCount > 0 ? styles.count : styles.placeholder
                          }
                        >
                          {g.childCount > 0 ? g.childCount : "—"}
                        </span>
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      {canUpdateGroup || canDeleteGroup ? (
                        <GroupActionsKebab
                          groupId={g.id}
                          groupName={g.name}
                          canEdit={canUpdateGroup}
                          canDelete={canDeleteGroup}
                        />
                      ) : (
                        <Link href={href} className={styles.cellLink}>
                          <ChevronRight size={14} className={styles.chev} />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode === "new" && canCreateGroup && (
        <GroupEditDrawer
          initialGroup={null}
          accountOptions={accounts}
          parentOptions={parentOptions}
        />
      )}
      {drawerMode === "edit" && canUpdateGroup && drawerInitial && (
        <GroupEditDrawer
          initialGroup={drawerInitial}
          accountOptions={accounts}
          parentOptions={parentOptions}
        />
      )}
    </div>
  );
}
