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
//  /gestion/grupos · S5-T1 · migrado a DataTable v2
//  ─────────────────────────────────────────────────────────────
//  Mismo wrapper GroupsTable que /catalogos/grupos, pero con
//  linkBuilder distinto · click va a la lista de vehículos
//  filtrada por ese grupo.
// ═══════════════════════════════════════════════════════════════

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function GruposGestionPage({ searchParams }: PageProps) {
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

        <GroupsTable
          rows={rows}
          linkBuilder={(id) =>
            `/gestion/vehiculos?groupId=${encodeURIComponent(id)}`
          }
          emptyMessage={
            search
              ? `No hay grupos que coincidan con "${search}".`
              : "No hay grupos cargados."
          }
          exportFilename="grupos-gestion"
        />
      </div>
    </>
  );
}
