// ═══════════════════════════════════════════════════════════════
//  URL helpers for /seguimiento/historial
//  ─────────────────────────────────────────────────────────────
//  Filters: which asset, which day, optional time range.
//
//  F2: time range support · `?from=HH:MM&to=HH:MM`. Both must
//  parse as valid HH:MM and from < to to take effect; otherwise
//  the page falls back to the full day.
//
//  When navigating from /seguimiento/viajes, we pass the trip's
//  startedAt and endedAt (formatted as HH:MM in AR-local time)
//  so the user lands on just that trip. They can widen or change
//  the range with the time inputs in the filter bar.
// ═══════════════════════════════════════════════════════════════

export interface HistoricosParams {
  assetId: string | null;
  date: string | null; // YYYY-MM-DD
  fromTime: string | null; // HH:MM
  toTime: string | null; // HH:MM
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isValidTime(s: string): boolean {
  if (!TIME_RE.test(s)) return false;
  const [hh, mm] = s.split(":").map((x) => parseInt(x, 10));
  if (hh === undefined || mm === undefined) return false;
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function parseHistoricosParams(
  raw: Record<string, string | string[] | undefined>,
): HistoricosParams {
  const get = (k: string): string | null => {
    const v = raw[k];
    if (Array.isArray(v)) return v[0] ?? null;
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  };

  const assetId = get("assetId");
  const dateRaw = get("date");
  const date = dateRaw && DATE_RE.test(dateRaw) ? dateRaw : null;

  // Time range · both must be present and valid; otherwise null.
  // We don't half-accept (only `from`) because the UI always
  // operates on a closed [from, to] interval.
  const fromRaw = get("from");
  const toRaw = get("to");
  let fromTime: string | null = null;
  let toTime: string | null = null;
  if (
    fromRaw &&
    toRaw &&
    isValidTime(fromRaw) &&
    isValidTime(toRaw) &&
    fromRaw < toRaw
  ) {
    fromTime = fromRaw;
    toTime = toRaw;
  }

  return { assetId, date, fromTime, toTime };
}

export function buildHistoricosHref(
  current: HistoricosParams,
  override: Partial<HistoricosParams>,
): string {
  const merged: HistoricosParams = { ...current, ...override };
  const params = new URLSearchParams();
  if (merged.assetId) params.set("assetId", merged.assetId);
  if (merged.date) params.set("date", merged.date);
  if (merged.fromTime && merged.toTime) {
    params.set("from", merged.fromTime);
    params.set("to", merged.toTime);
  }
  const qs = params.toString();
  return qs ? `/seguimiento/historial?${qs}` : "/seguimiento/historial";
}

/**
 * Returns yesterday's date as YYYY-MM-DD in Argentina local time
 * (UTC-3). Used as the default when the user lands on the page
 * without a date filter.
 */
export function defaultDate(): string {
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowLocalMs = Date.now() - AR_OFFSET_MS;
  const yesterdayLocalMs = nowLocalMs - 24 * 60 * 60 * 1000;
  return new Date(yesterdayLocalMs).toISOString().slice(0, 10);
}

/**
 * Format a Date as HH:MM in Argentina local time. Used when
 * building hrefs from /seguimiento/viajes that target a specific
 * trip on the historial page.
 */
export function arLocalTimeHHMM(d: Date): string {
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Format a Date as YYYY-MM-DD in Argentina local time.
 */
export function arLocalYmd(d: Date): string {
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const local = new Date(d.getTime() - AR_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const da = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
