"use client";

import {
  DeleteAllMatchingDialog,
  type DeleteAllMatchingResult,
} from "@/components/admin/DeleteAllMatchingDialog";
import {
  deleteAllMatchingDrivers,
  type DeleteAllMatchingDriversFilters,
} from "./actions";

interface Props {
  count: number;
  filters: DeleteAllMatchingDriversFilters;
  activeFilterChips: { label: string; value: string }[];
}

export function DeleteAllDriversDialog({
  count,
  filters,
  activeFilterChips,
}: Props) {
  async function action(): Promise<DeleteAllMatchingResult> {
    return deleteAllMatchingDrivers(filters);
  }

  return (
    <DeleteAllMatchingDialog
      entityNameSingular="conductor"
      entityNamePlural="conductores"
      count={count}
      activeFilterChips={activeFilterChips}
      action={action}
    />
  );
}
