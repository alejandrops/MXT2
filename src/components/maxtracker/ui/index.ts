// ═══════════════════════════════════════════════════════════════
//  src/components/maxtracker/ui/ · barrel exports
//  ─────────────────────────────────────────────────────────────
//  Componentes UI reusables. Mezcla de:
//   · Componentes legacy (BackButton, KpiCard, PageHeader, etc.)
//   · Filter UI primitivas L3-style + L3-style-2
//     (FilterFieldGroup, SelectField, SearchField)
// ═══════════════════════════════════════════════════════════════

// ── Legacy ────────────────────────────────────────────────────
export { BackButton } from "./BackButton";
export { ClearFiltersButton } from "./ClearFiltersButton";
export { DataTable, type ColumnDef } from "./DataTable";
export { EmptyState } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export {
  ExportMenu,
  granularityToPeriod,
  type PrintPeriodKey,
} from "./ExportMenu";
export { GlobalFilterBar } from "./GlobalFilterBar";
export { KpiCard, type KpiSize } from "./KpiCard";
export { LoadingState } from "./LoadingState";
export { PageHeader, type ObjectStatus } from "./PageHeader";
export { RankingList, type RankingItem } from "./RankingList";

// ── Filter UI primitives · L3-style + L3-style-2 ─────────────
export { FilterFieldGroup } from "./FilterFieldGroup";
export { SelectField } from "./SelectField";
export { SearchField } from "./SearchField";
