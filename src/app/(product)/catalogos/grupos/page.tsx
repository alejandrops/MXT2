import Link from "next/link";
import {
  getGroupCounts,
  listGroupsWithCounts,
} from "@/lib/queries";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getSession } from "@/lib/session";
import { KpiTile } from "@/components/maxtracker";
import { PageHeader } from "@/components/maxtracker/ui";
import { GroupsTable } from "@/components/maxtracker/groups/GroupsTable";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /catalogos/grupos · S5-T1 · migrado a DataTable v2
//  ─────────────────────────────────────────────────────────────
//  La tabla custom interna se reemplazó por GroupsTable client
//  component, que internamente usa DataTable v2.
//  Click en fila → /objeto/grupo/{id} (Libro del grupo).
// ═══════════════════════════════════════════════════════════════

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function GruposPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;

  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "catalogos", null);

  const [counts, rows] = await Promise.all([
    getGroupCounts(scopedAccountId),
    listGroupsWithCounts({ search, accountId: scopedAccountId }),
  ]);

  return (
    <>
      <PageHeader variant="module" title="Grupos" />
      <div className="appPage">
        <div className={styles.kpiStrip}>
          <KpiTile label="Grupos totales" value={counts.totalGroups} />
          <KpiTile label="Grupos raíz" value={counts.totalRoots} />
          <KpiTile
            label="Vehículos asignados"
            value={counts.totalVehicles}
          />
        </div>

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

        <GroupsTable
          rows={rows}
          linkBuilder={(id) => `/objeto/grupo/${encodeURIComponent(id)}`}
          emptyMessage={
            search
              ? `No hay grupos que coincidan con "${search}".`
              : "No hay grupos cargados."
          }
          exportFilename="grupos-catalogo"
        />
      </div>
    </>
  );
}
