import Link from "next/link";
import styles from "./Tabs.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tabs
//  ─────────────────────────────────────────────────────────────
//  Generic horizontal tabs with URL state. Each tab is a Link
//  so the user can deep-link to a tab and back/forward works.
//
//  Tab state lives in `?tab=...` as a search param. The default
//  (no param) is the first tab.
//
//  Why URL-based instead of useState:
//    · Bookmarkable
//    · Server Components can read it
//    · Browser history works
//
//  Disabled tabs render as muted spans. Clicking does nothing.
// ═══════════════════════════════════════════════════════════════

export interface TabDef {
  key: string;
  label: string;
  count?: number;
  disabled?: boolean;
  /**
   * If set, clicking the tab navigates to this href instead of
   * the default basePath?tab=key. Used when a tab represents
   * a separate page (e.g. "Histórico" → /seguimiento/historial).
   */
  href?: string;
}

interface TabsProps {
  /** Base path for the route (without query string) */
  basePath: string;
  /** Available tabs */
  tabs: TabDef[];
  /** Currently active tab key (default first non-disabled) */
  active: string;
}

export function Tabs({ basePath, tabs, active }: TabsProps) {
  return (
    <nav className={styles.bar} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        if (tab.disabled) {
          return (
            <span
              key={tab.key}
              className={`${styles.tab} ${styles.disabled}`}
              role="tab"
              aria-disabled="true"
              title="Próximamente"
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span className={styles.count}>{tab.count}</span>
              )}
            </span>
          );
        }

        // External link tab (e.g. "Histórico" → /seguimiento/historial)
        // takes precedence over default basePath?tab=key behavior.
        const href =
          tab.href ??
          (tab.key === tabs[0]?.key
            ? basePath
            : `${basePath}?tab=${encodeURIComponent(tab.key)}`);

        return (
          <Link
            key={tab.key}
            href={href}
            className={`${styles.tab} ${isActive ? styles.active : ""}`}
            role="tab"
            aria-selected={isActive}
            scroll={false}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className={styles.count}>{tab.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
