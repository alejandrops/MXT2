// ═══════════════════════════════════════════════════════════════
//  URL helpers for /catalogos/conductores
//  ─────────────────────────────────────────────────────────────
//  Same pattern as assets list: search + accountId + status filter,
//  sort field + direction, page. All validated against allowed
//  values; invalid values are dropped silently.
// ═══════════════════════════════════════════════════════════════

export type DriverStatus = "active" | "inactive";
export type DriverSort = "name" | "safetyScore" | "events30d";
export type SortDir = "asc" | "desc";

export interface DriversSearchParams {
  search: string | null;
  accountId: string | null;
  status: DriverStatus | null;
  sort: DriverSort;
  dir: SortDir;
  page: number;
}

const VALID_STATUS: DriverStatus[] = ["active", "inactive"];
const VALID_SORT: DriverSort[] = ["name", "safetyScore", "events30d"];

export function parseDriversParams(
  raw: Record<string, string | string[] | undefined>,
): DriversSearchParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const search = get("search");
  const accountId = get("accountId");

  const statusRaw = get("status");
  const status =
    statusRaw && (VALID_STATUS as string[]).includes(statusRaw)
      ? (statusRaw as DriverStatus)
      : null;

  const sortRaw = get("sort");
  const sort =
    sortRaw && (VALID_SORT as string[]).includes(sortRaw)
      ? (sortRaw as DriverSort)
      : "name";

  const dirRaw = get("dir");
  const dir: SortDir = dirRaw === "desc" ? "desc" : "asc";

  const pageRaw = get("page");
  const pageNum = pageRaw ? parseInt(pageRaw, 10) : 1;
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { search, accountId, status, sort, dir, page };
}

export function buildDriversHref(
  current: DriversSearchParams,
  override: Partial<DriversSearchParams>,
): string {
  const isFilterChange =
    "search" in override ||
    "accountId" in override ||
    "status" in override;

  const merged: DriversSearchParams = {
    ...current,
    ...override,
    page:
      "page" in override
        ? override.page!
        : isFilterChange
          ? 1
          : current.page,
  };

  const params = new URLSearchParams();
  if (merged.search) params.set("search", merged.search);
  if (merged.accountId) params.set("accountId", merged.accountId);
  if (merged.status) params.set("status", merged.status);
  if (merged.sort && merged.sort !== "name") params.set("sort", merged.sort);
  if (merged.dir && merged.dir !== "asc") params.set("dir", merged.dir);
  if (merged.page && merged.page !== 1) {
    params.set("page", String(merged.page));
  }

  const qs = params.toString();
  return qs ? `/catalogos/conductores?${qs}` : "/catalogos/conductores";
}
