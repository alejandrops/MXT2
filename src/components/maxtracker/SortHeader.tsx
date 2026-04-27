import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  buildAssetsHref,
  type AssetsSearchParams,
  type SortField,
} from "@/lib/url";
import styles from "./SortHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  SortHeader
//  ─────────────────────────────────────────────────────────────
//  Clickable table column header. Server component that emits a
//  Link with sort/dir overrides:
//    · Clicking an inactive column sorts by that column ASC
//    · Clicking the active column flips DIR
//
//  Visual: active column shows direction arrow, inactive ones
//  show a faint up/down toggle hint on hover.
// ═══════════════════════════════════════════════════════════════

interface SortHeaderProps {
  field: SortField | null;        // null = non-sortable column
  label: string;
  current: AssetsSearchParams;
  align?: "left" | "right";
}

export function SortHeader({
  field,
  label,
  current,
  align = "left",
}: SortHeaderProps) {
  // Non-sortable column — render plain text
  if (field === null) {
    return (
      <th className={`${styles.th} ${styles[`align_${align}`]}`}>
        <span className={styles.plain}>{label}</span>
      </th>
    );
  }

  const isActive = current.sort === field;
  const nextDir = isActive
    ? current.dir === "asc"
      ? "desc"
      : "asc"
    : "asc";

  const href = buildAssetsHref(current, { sort: field, dir: nextDir });

  return (
    <th className={`${styles.th} ${styles[`align_${align}`]}`}>
      <Link
        href={href}
        className={`${styles.link} ${isActive ? styles.active : ""}`}
        scroll={false}
      >
        <span>{label}</span>
        <span className={styles.arrow}>
          {isActive ? (
            current.dir === "asc" ? (
              <ArrowUp size={11} />
            ) : (
              <ArrowDown size={11} />
            )
          ) : (
            <ArrowUpDown size={11} className={styles.idle} />
          )}
        </span>
      </Link>
    </th>
  );
}
