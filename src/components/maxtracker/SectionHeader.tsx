import styles from "./SectionHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  SectionHeader
//  ─────────────────────────────────────────────────────────────
//  Uppercase H2 with optional count badge and right-aligned slot.
//  Visual reference: Samsara dashboard section headers, slightly
//  more typographically restrained.
// ═══════════════════════════════════════════════════════════════

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>
        {title}
        {typeof count === "number" && (
          <span className={styles.count}>{count}</span>
        )}
      </h2>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
