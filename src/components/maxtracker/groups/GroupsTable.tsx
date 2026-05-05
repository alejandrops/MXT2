"use client";

import { useRouter } from "next/navigation";
import type { GroupListRow } from "@/lib/queries/groups";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";

// ═══════════════════════════════════════════════════════════════
//  GroupsTable · S5-T1
//  ─────────────────────────────────────────────────────────────
//  Componente cliente reusable para listar grupos. Lo usan:
//    · /catalogos/grupos  · linkBuilder = /objeto/grupo/{id}
//    · /gestion/grupos    · linkBuilder = /gestion/vehiculos?groupId={id}
//
//  Como las páginas son server components, el wrapper cliente
//  delega click-row → router.push(href). DataTable lo trata como
//  cualquier otra tabla con onRowClick.
// ═══════════════════════════════════════════════════════════════

interface Props {
  rows: GroupListRow[];
  linkBuilder: (id: string) => string;
  emptyMessage: string;
  exportFilename?: string;
}

export function GroupsTable({
  rows,
  linkBuilder,
  emptyMessage,
  exportFilename = "grupos",
}: Props) {
  const router = useRouter();

  const columns: ColumnDef<GroupListRow>[] = [
    {
      key: "name",
      label: "Grupo",
      sortable: true,
      sortValue: (r) => r.name.toLowerCase(),
      render: (g) => <span style={{ fontWeight: 500 }}>{g.name}</span>,
    },
    {
      key: "accountName",
      label: "Cuenta",
      sortable: true,
      sortValue: (r) => r.accountName?.toLowerCase() ?? "",
      render: (g) => (
        <span style={{ color: "#6b7280" }}>{g.accountName ?? "—"}</span>
      ),
    },
    {
      key: "parentName",
      label: "Padre",
      sortable: true,
      sortValue: (r) => r.parentName?.toLowerCase() ?? "",
      render: (g) =>
        g.parentName ? (
          <span style={{ color: "#6b7280" }}>{g.parentName}</span>
        ) : (
          <span style={{ color: "#c0c4ca" }}>—</span>
        ),
    },
    {
      key: "vehicleCount",
      label: "Vehículos",
      align: "right",
      mono: true,
      sortable: true,
      sortValue: (r) => r.vehicleCount,
      render: (g) => g.vehicleCount,
    },
  ];

  return (
    <DataTable<GroupListRow>
      columns={columns}
      rows={rows}
      rowKey={(g) => g.id}
      title="Grupos"
      count={rows.length}
      onRowClick={(g) => router.push(linkBuilder(g.id))}
      defaultSort={{ key: "name", dir: "asc" }}
      emptyMessage={emptyMessage}
      exportFormats={["csv"]}
      exportFilename={exportFilename}
      exportColumns={[
        { header: "Grupo", value: (g) => g.name },
        { header: "Cuenta", value: (g) => g.accountName ?? "" },
        { header: "Padre", value: (g) => g.parentName ?? "" },
        { header: "Vehiculos", value: (g) => g.vehicleCount },
      ]}
    />
  );
}
