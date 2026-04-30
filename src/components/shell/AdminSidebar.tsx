"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  LayoutGrid,
  Users,
  Truck,
  IdCard,
  Smartphone,
  CircleSlash,
  Wrench,
  Shield,
  UserCog,
  ShieldCheck,
  Activity,
} from "lucide-react";
import styles from "./AdminSidebar.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminSidebar · backoffice dark nav (mirror of v8 #bo-sb)
//  ─────────────────────────────────────────────────────────────
//  Replaces the product Sidebar inside /admin. Uses a flat list
//  of pages (no accordion) because backoffice is a smaller scope:
//
//    [Maxtracker · ADMIN]
//    [Dashboard]
//    [Clientes]
//    [Dispositivos]
//    [Líneas SIM]
//    [Instalaciones]
//    ...
//    [← Volver al producto]
//
//  Style: dark navy bg #1A1F2E with purple accents #6366F1 to
//  visually contrast with the light product surface.
// ═══════════════════════════════════════════════════════════════

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutGrid size={15} /> },
  { href: "/admin/clientes", label: "Clientes", icon: <Users size={15} /> },
  {
    href: "/admin/vehiculos",
    label: "Vehículos",
    icon: <Truck size={15} />,
  },
  {
    href: "/admin/conductores",
    label: "Conductores",
    icon: <IdCard size={15} />,
  },
  {
    href: "/admin/dispositivos",
    label: "Dispositivos",
    icon: <Smartphone size={15} />,
  },
  {
    href: "/admin/ingestion-status",
    label: "Estado ingestion",
    icon: <Activity size={15} />,
  },
  {
    href: "/admin/sims",
    label: "Líneas SIM",
    icon: <CircleSlash size={15} />,
  },
  {
    href: "/admin/instalaciones",
    label: "Instalaciones",
    icon: <Wrench size={15} />,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: <UserCog size={15} />,
  },
  {
    href: "/admin/perfiles",
    label: "Perfiles",
    icon: <ShieldCheck size={15} />,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  // Match active item by exact match for /admin (root) or by
  // prefix for nested routes
  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className={styles.sidebar}>
      {/* ── Brand ─────────────────────────────────────────── */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <Shield size={14} />
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>MAXTRACKER</span>
          <span className={styles.brandLabel}>Admin</span>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Backoffice">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer · back to product ─────────────────────── */}
      <div className={styles.footer}>
        <Link href="/" className={styles.exitItem}>
          <span className={styles.navIcon}>
            <ChevronLeft size={15} />
          </span>
          <span className={styles.navLabel}>Volver al producto</span>
        </Link>
      </div>
    </aside>
  );
}
