// ═══════════════════════════════════════════════════════════════
//  URL helpers for /seguimiento/historial (Sub-lote 3.4)
//  ─────────────────────────────────────────────────────────────
//  Filters: which asset, which day. Both required for the page
//  to render meaningful content; if missing we show an empty
//  state prompting the user to pick.
// ═══════════════════════════════════════════════════════════════

export interface HistoricosParams {
  assetId: string | null;
  date: string | null; // YYYY-MM-DD
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  return { assetId, date };
}

export function buildHistoricosHref(
  current: HistoricosParams,
  override: Partial<HistoricosParams>,
): string {
  const merged: HistoricosParams = { ...current, ...override };
  const params = new URLSearchParams();
  if (merged.assetId) params.set("assetId", merged.assetId);
  if (merged.date) params.set("date", merged.date);
  const qs = params.toString();
  return qs ? `/seguimiento/historial?${qs}` : "/seguimiento/historial";
}

/**
 * Returns yesterday's date as YYYY-MM-DD in Argentina local time
 * (UTC-3). Used as the default when the user lands on the page
 * without a date filter.
 *
 * Critical: must use AR local time because the query also uses
 * AR local day boundaries — using UTC here would cause a 3-hour
 * offset bug between 21:00 and 23:59 AR (when UTC has rolled to
 * the next day but AR hasn't).
 */
export function defaultDate(): string {
  const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowLocalMs = Date.now() - AR_OFFSET_MS;
  const yesterdayLocalMs = nowLocalMs - 24 * 60 * 60 * 1000;
  return new Date(yesterdayLocalMs).toISOString().slice(0, 10);
}
