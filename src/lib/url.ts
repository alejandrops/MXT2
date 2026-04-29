// ═══════════════════════════════════════════════════════════════
//  URL helpers for the assets list
//  ─────────────────────────────────────────────────────────────
//  Parses Next.js searchParams into a typed shape, and rebuilds
//  URLs from a partial override.
//
//  Source of truth: the URL. Filters and pagination state live
//  here so links are shareable and back/forward works.
// ═══════════════════════════════════════════════════════════════

import type { AssetStatus, MobilityType } from "@/types/domain";

export type SortField = "name" | "status" | "speedKmh";
export type SortDir = "asc" | "desc";

export interface AssetsSearchParams {
  search: string | null;
  accountId: string | null;
  groupId: string | null;
  status: AssetStatus | null;
  mobility: MobilityType | null;
  sort: SortField;
  dir: SortDir;
  page: number;
}

const VALID_STATUS: AssetStatus[] = [
  "MOVING",
  "IDLE",
  "STOPPED",
  "OFFLINE",
  "MAINTENANCE",
];
const VALID_MOBILITY: MobilityType[] = ["MOBILE", "FIXED"];
const VALID_SORT: SortField[] = ["name", "status", "speedKmh"];

/**
 * Parse a Next.js searchParams object into a typed, validated
 * shape. Invalid values are ignored (set to null/default).
 */
export function parseAssetsParams(
  raw: Record<string, string | string[] | undefined>,
): AssetsSearchParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const search = get("search");
  const accountId = get("accountId");
  const groupId = get("groupId");

  const statusRaw = get("status");
  const status =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as AssetStatus)
      : null;

  const mobilityRaw = get("mobility");
  const mobility =
    mobilityRaw && (VALID_MOBILITY as string[]).includes(mobilityRaw)
      ? (mobilityRaw as MobilityType)
      : null;

  const sortRaw = get("sort");
  const sort =
    sortRaw && (VALID_SORT as string[]).includes(sortRaw)
      ? (sortRaw as SortField)
      : "name";

  const dirRaw = get("dir");
  const dir: SortDir = dirRaw === "desc" ? "desc" : "asc";

  const pageRaw = get("page");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { search, accountId, groupId, status, mobility, sort, dir, page };
}

/**
 * Builds a `/catalogos/vehiculos?...` URL by merging the current
 * params with an override. Pass any field as `null` to clear it.
 *
 * If `override.page` is not provided AND any filter is being
 * changed, page is reset to 1 (don't leave the user on page 4
 * after switching from "all" to "MOVING").
 */
export function buildAssetsHref(
  current: AssetsSearchParams,
  override: Partial<AssetsSearchParams>,
): string {
  const isFilterChange =
    "search" in override ||
    "accountId" in override ||
    "groupId" in override ||
    "status" in override ||
    "mobility" in override;

  const merged: AssetsSearchParams = {
    ...current,
    ...override,
    page: "page" in override ? override.page! : isFilterChange ? 1 : current.page,
  };

  const params = new URLSearchParams();
  if (merged.search) params.set("search", merged.search);
  if (merged.accountId) params.set("accountId", merged.accountId);
  if (merged.groupId) params.set("groupId", merged.groupId);
  if (merged.status) params.set("status", merged.status);
  if (merged.mobility) params.set("mobility", merged.mobility);
  if (merged.sort !== "name") params.set("sort", merged.sort);
  if (merged.dir !== "asc") params.set("dir", merged.dir);
  if (merged.page !== 1) params.set("page", String(merged.page));

  const qs = params.toString();
  return qs ? `/catalogos/vehiculos?${qs}` : "/catalogos/vehiculos";
}

/**
 * Returns true if any filter is currently active. Used to decide
 * whether to render the "Limpiar filtros" button.
 */
export function hasActiveFilters(p: AssetsSearchParams): boolean {
  return Boolean(
    p.search || p.accountId || p.groupId || p.status || p.mobility,
  );
}
