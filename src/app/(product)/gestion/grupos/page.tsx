import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getGroupCounts,
  listGroupsWithCounts,
} from "@/lib/queries";
import { KpiTile } from "@/components/maxtracker";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /gestion/grupos · Lote A · simple list with counts
//  ─────────────────────────────────────────────────────────────
//  Flat list (no tree yet) of all groups across all accounts.
//  Each row links to /gestion/vehiculos?groupId=X to show the
//  vehicles that belong to the group.
//
//  Future iterations:
//    · Tree view (parent/children) with bubbling counts
//    · Edit / create groups inline
//    · Bulk reassign vehicles between groups
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function GruposPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;

  const [counts, rows] = await Promise.all([
    getGroupCounts(),
    listGroupsWithCounts({ search }),
  ]);

  return (
    <div className={styles.page}>
      {/* ── KPI strip ──────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiTile label="Grupos totales" value={counts.totalGroups} />
        <KpiTile label="Grupos raíz" value={counts.totalRoots} />
        <KpiTile
          label="Vehículos asignados"
          value={counts.totalVehicles}
        />
      </div>

      {/* ── Search bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/gestion/grupos">
        <input
          name="q"
          type="search"
          defaultValue={search ?? ""}
          placeholder="Buscar grupo por nombre…"
          className={styles.searchInput}
        />
        {search && (
          <Link href="/gestion/grupos" className={styles.clearLink}>
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
                <th className={styles.thAction} aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const href = `/gestion/vehiculos?groupId=${encodeURIComponent(g.id)}`;
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
                        <span className={styles.count}>
                          {g.vehicleCount}
                        </span>
                      </Link>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      <Link href={href} className={styles.cellLink}>
                        <ChevronRight
                          size={14}
                          className={styles.chev}
                        />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
