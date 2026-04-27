// ═══════════════════════════════════════════════════════════════
//  URL helpers for /seguimiento/viajes
//  ─────────────────────────────────────────────────────────────
//  Filters: date range (from/to · inclusive), optional asset list.
//  Default: last 7 days, all vehicles.
// ═══════════════════════════════════════════════════════════════

export interface TripsParams {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  assetIds: string[]; // empty = all
  groupIds: string[]; // empty = all
  personIds: string[]; // empty = all
  sort: SortKey;
  sortDir: "asc" | "desc";
}

export type SortKey =
  | "startedAt"
  | "asset"
  | "driver"
  | "distance"
  | "duration"
  | "events";

const ALLOWED_SORT_KEYS: SortKey[] = [
  "startedAt",
  "asset",
  "driver",
  "distance",
  "duration",
  "events",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Default range: last 7 days ending today (Argentina local).
 * Sundays count, so it's a rolling 7-day window.
 */
export function defaultTripsRange(): { fromDate: string; toDate: string } {
  // We pin the demo's "today" to the latest date in the seeded
  // CSVs (26-Apr-2026) so the page lands on data out of the box.
  // Real production would use new Date() here.
  const today = new Date("2026-04-26T12:00:00.000Z");
  const seven = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  return {
    fromDate: ymd(seven),
    toDate: ymd(today),
  };
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function parseTripsParams(
  raw: Record<string, string | string[] | undefined>,
): TripsParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const fallback = defaultTripsRange();
  const fromRaw = get("from");
  const toRaw = get("to");
  const assetParam = get("assets");
  const groupParam = get("groups");
  const personParam = get("drivers");
  const sortRaw = get("sort");
  const sortDirRaw = get("dir");

  const fromDate = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : fallback.fromDate;
  const toDate = toRaw && DATE_RE.test(toRaw) ? toRaw : fallback.toDate;

  const assetIds = assetParam
    ? assetParam.split(",").filter((s) => s.length > 0)
    : [];
  const groupIds = groupParam
    ? groupParam.split(",").filter((s) => s.length > 0)
    : [];
  const personIds = personParam
    ? personParam.split(",").filter((s) => s.length > 0)
    : [];

  const sort: SortKey =
    sortRaw && ALLOWED_SORT_KEYS.includes(sortRaw as SortKey)
      ? (sortRaw as SortKey)
      : "startedAt";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";

  return { fromDate, toDate, assetIds, groupIds, personIds, sort, sortDir };
}

export function buildTripsHref(
  current: TripsParams,
  override: Partial<TripsParams>,
): string {
  const merged: TripsParams = { ...current, ...override };
  const params = new URLSearchParams();
  params.set("from", merged.fromDate);
  params.set("to", merged.toDate);
  if (merged.assetIds.length > 0) {
    params.set("assets", merged.assetIds.join(","));
  }
  if (merged.groupIds.length > 0) {
    params.set("groups", merged.groupIds.join(","));
  }
  if (merged.personIds.length > 0) {
    params.set("drivers", merged.personIds.join(","));
  }
  if (merged.sort !== "startedAt") {
    params.set("sort", merged.sort);
  }
  if (merged.sortDir !== "desc") {
    params.set("dir", merged.sortDir);
  }
  return `/seguimiento/viajes?${params.toString()}`;
}

/**
 * Convert from a YYYY-MM-DD into a Date suitable for an <input
 * type="date"> "max" attribute, etc. Local time, no offset trick.
 */
export function ymdToInputDate(ymd: string): string {
  return ymd;
}
