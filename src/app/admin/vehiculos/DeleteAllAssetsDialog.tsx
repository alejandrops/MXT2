"use client";

import {
  DeleteAllMatchingDialog,
  type DeleteAllMatchingResult,
} from "@/components/admin/DeleteAllMatchingDialog";
import {
  deleteAllMatchingAssets,
  type DeleteAllMatchingAssetsFilters,
} from "./actions";

// ═══════════════════════════════════════════════════════════════
//  DeleteAllAssetsDialog · wrapper específico de vehículos (H5b)
//  ─────────────────────────────────────────────────────────────
//  Captura los filtros activos como props y los pasa a la action
//  server-side. El DeleteAllMatchingDialog genérico se encarga
//  del UI · este wrapper solo conecta dominio + componente.
// ═══════════════════════════════════════════════════════════════

interface Props {
  count: number;
  filters: DeleteAllMatchingAssetsFilters;
  activeFilterChips: { label: string; value: string }[];
}

export function DeleteAllAssetsDialog({
  count,
  filters,
  activeFilterChips,
}: Props) {
  async function action(): Promise<DeleteAllMatchingResult> {
    const r = await deleteAllMatchingAssets(filters);
    return r;
  }

  return (
    <DeleteAllMatchingDialog
      entityNameSingular="vehículo"
      entityNamePlural="vehículos"
      count={count}
      activeFilterChips={activeFilterChips}
      action={action}
    />
  );
}
