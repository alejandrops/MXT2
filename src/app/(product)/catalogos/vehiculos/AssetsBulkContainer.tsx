"use client";

import { useState } from "react";
import { AssetTable } from "@/components/maxtracker";
import {
  BulkActionsToolbar,
  type GroupOption,
  type DriverOption,
} from "./BulkActionsToolbar";
import type { AssetsSearchParams } from "@/lib/url";
import type { AssetListRow } from "@/types/domain";

// ═══════════════════════════════════════════════════════════════
//  AssetsBulkContainer · maneja state de selección + monta
//  tabla con checkboxes y toolbar bulk arriba.
// ═══════════════════════════════════════════════════════════════

interface Props {
  rows: AssetListRow[];
  current: AssetsSearchParams;
  groupOptions: GroupOption[];
  driverOptions: DriverOption[];
  /** H7b · si false, oculta el botón "Dar de baja" del toolbar */
  canDelete: boolean;
  /** H7b · permisos para el kebab por fila */
  canEdit: boolean;
  canBulkUpdate: boolean;
}

export function AssetsBulkContainer({
  rows,
  current,
  groupOptions,
  driverOptions,
  canDelete,
  canEdit,
  canBulkUpdate,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = rows.map((r) => r.id);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      // Si TODOS los visibles están en el set, deseleccionar
      const allInSet = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allInSet) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clear() {
    setSelectedIds(new Set());
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <>
      {hasSelection && canBulkUpdate && (
        <BulkActionsToolbar
          selectedIds={Array.from(selectedIds)}
          onClear={clear}
          groupOptions={groupOptions}
          driverOptions={driverOptions}
          canDelete={canDelete}
        />
      )}

      <AssetTable
        rows={rows}
        current={current}
        showActions={true}
        bulkSelection={
          canBulkUpdate || canDelete
            ? {
                selectedIds,
                onToggle: toggle,
                onToggleAll: toggleAll,
                visibleIds,
              }
            : undefined
        }
        canEditAsset={canEdit}
        canDeleteAsset={canDelete}
      />
    </>
  );
}
