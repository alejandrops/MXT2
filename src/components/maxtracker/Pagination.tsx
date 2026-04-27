import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import styles from "./Pagination.module.css";

// ═══════════════════════════════════════════════════════════════
//  Pagination
//  ─────────────────────────────────────────────────────────────
//  Bottom-of-list pager. Shows:
//    "Mostrando X–Y de Z"   ← prev   1 2 ... 7 8 9 ... 12   next →
//
//  Algorithm for page number rendering:
//    · Always show first and last page
//    · Show current ± 1
//    · Show ellipsis where gaps exist
//
//  Generic over the "buildHref" callback so the same component
//  works for /assets, /alarmas, and any future paginated list.
//  Each page passes its own URL builder (e.g. buildAlarmsHref).
//
//  Server component. All Links built statically.
// ═══════════════════════════════════════════════════════════════

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  buildHref: (page: number) => string;
}

export function Pagination({
  total,
  page,
  pageSize,
  pageCount,
  buildHref,
}: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const prevHref = page > 1 ? buildHref(page - 1) : null;
  const nextHref = page < pageCount ? buildHref(page + 1) : null;

  const pageNumbers = computePageNumbers(page, pageCount);

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        Mostrando <strong>{formatNumber(from)}–{formatNumber(to)}</strong> de{" "}
        <strong>{formatNumber(total)}</strong>
      </div>

      <nav className={styles.nav} aria-label="Paginación">
        {prevHref ? (
          <Link href={prevHref} className={styles.btn} scroll={false}>
            <ChevronLeft size={13} />
            <span>Anterior</span>
          </Link>
        ) : (
          <span className={`${styles.btn} ${styles.disabled}`}>
            <ChevronLeft size={13} />
            <span>Anterior</span>
          </span>
        )}

        <div className={styles.pages}>
          {pageNumbers.map((n, i) =>
            n === "..." ? (
              <span key={`gap_${i}`} className={styles.gap}>
                …
              </span>
            ) : (
              <Link
                key={n}
                href={buildHref(n)}
                className={`${styles.pageBtn} ${
                  n === page ? styles.pageActive : ""
                }`}
                scroll={false}
              >
                {n}
              </Link>
            ),
          )}
        </div>

        {nextHref ? (
          <Link href={nextHref} className={styles.btn} scroll={false}>
            <span>Siguiente</span>
            <ChevronRight size={13} />
          </Link>
        ) : (
          <span className={`${styles.btn} ${styles.disabled}`}>
            <span>Siguiente</span>
            <ChevronRight size={13} />
          </span>
        )}
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helper · compute page numbers with ellipsis
// ═══════════════════════════════════════════════════════════════

function computePageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const result: (number | "...")[] = [1];

  if (current > 3) result.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) result.push(i);

  if (current < total - 2) result.push("...");

  result.push(total);

  return result;
}
