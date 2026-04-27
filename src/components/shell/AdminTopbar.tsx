"use client";

import { usePathname } from "next/navigation";
import styles from "./AdminTopbar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminTopbar · backoffice topbar
//  ─────────────────────────────────────────────────────────────
//  Mirrors v8 BO topbar: "Admin › <page>" breadcrumb + purple
//  "Maxtracker Admin" pill on the right.
// ═══════════════════════════════════════════════════════════════

const PAGE_LABELS: Record<string, string> = {
  admin: "Dashboard",
  clientes: "Clientes",
  dispositivos: "Dispositivos",
  sims: "Líneas SIM",
  instalaciones: "Instalaciones",
};

export function AdminTopbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] === 'admin'
  const sub = segments[1];

  // Breadcrumb: "ADMIN › Dashboard" (no sub) or "ADMIN › Clientes"
  const pageLabel =
    sub && PAGE_LABELS[sub] ? PAGE_LABELS[sub] : "Dashboard";

  return (
    <div className={styles.topbar}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <span className={styles.crumbModule}>ADMIN</span>
        <span className={styles.sep}>›</span>
        <span className={styles.crumbActive}>{pageLabel}</span>
      </nav>

      <div className={styles.spacer} />

      <div className={styles.adminPill}>Maxtracker Admin</div>
    </div>
  );
}
