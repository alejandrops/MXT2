"use client";

import {
  DeleteAllMatchingDialog,
  type DeleteAllMatchingResult,
} from "@/components/admin/DeleteAllMatchingDialog";
import {
  deleteAllMatchingSims,
  type DeleteAllMatchingSimsFilters,
} from "./actions";

interface Props {
  count: number;
  filters: DeleteAllMatchingSimsFilters;
  activeFilterChips: { label: string; value: string }[];
}

export function DeleteAllSimsDialog({
  count,
  filters,
  activeFilterChips,
}: Props) {
  async function action(): Promise<DeleteAllMatchingResult> {
    return deleteAllMatchingSims(filters);
  }

  return (
    <DeleteAllMatchingDialog
      entityNameSingular="SIM"
      entityNamePlural="SIMs"
      count={count}
      activeFilterChips={activeFilterChips}
      action={action}
    />
  );
}
