"use client";

import {
  DeleteAllMatchingDialog,
  type DeleteAllMatchingResult,
} from "@/components/admin/DeleteAllMatchingDialog";
import {
  deleteAllMatchingDevices,
  type DeleteAllMatchingDevicesFilters,
} from "./actions";

interface Props {
  count: number;
  filters: DeleteAllMatchingDevicesFilters;
  activeFilterChips: { label: string; value: string }[];
}

export function DeleteAllDevicesDialog({
  count,
  filters,
  activeFilterChips,
}: Props) {
  async function action(): Promise<DeleteAllMatchingResult> {
    return deleteAllMatchingDevices(filters);
  }

  return (
    <DeleteAllMatchingDialog
      entityNameSingular="dispositivo"
      entityNamePlural="dispositivos"
      count={count}
      activeFilterChips={activeFilterChips}
      action={action}
    />
  );
}
