"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, Settings, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Topbar.module.css";

// ═══════════════════════════════════════════════════════════════
//  Topbar — context row above page content
//  ─────────────────────────────────────────────────────────────
//  Breadcrumb derives from pathname. Avatar is now a dropdown
//  that exposes "Modo Administrador" as the primary entry into
//  the backoffice (mirrors v8 line 1056).
// ═══════════════════════════════════════════════════════════════

const MODULE_LABELS: Record<string, string> = {
  seguridad: "Seguridad",
  seguimiento: "Seguimiento",
  gestion: "Gestión",
  conduccion: "Conducción",
  logistica: "Logística",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  documentacion: "Documentación",
  sostenibilidad: "Sostenibilidad",
  direccion: "Dirección",
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  alarmas: "Alarmas",
  vehiculos: "Vehículos",
  conductores: "Conductores",
  grupos: "Grupos",
  historial: "Historial",
  mapa: "Mapa",
  viajes: "Viajes",
  "torre-de-control": "Torre de control",
  reporte: "Reporte",
  analisis: "Análisis",
  reportes: "Reportes",
};

export function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Build breadcrumb labels from URL segments
  const crumbs: { label: string; isLast: boolean }[] = [];
  segments.forEach((seg, i) => {
    const isLast = i === segments.length - 1;
    let label: string;
    if (i === 0) {
      label = MODULE_LABELS[seg] ?? seg;
    } else if (PAGE_LABELS[seg]) {
      label = PAGE_LABELS[seg];
    } else {
      label = seg.length > 12 ? seg.slice(0, 8) + "…" : seg;
    }
    crumbs.push({ label, isLast });
  });

  return (
    <div className={styles.topbar}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        {crumbs.length === 0 ? (
          <span className={styles.crumbActive}>Inicio</span>
        ) : (
          crumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              <span
                className={c.isLast ? styles.crumbActive : styles.crumbInactive}
              >
                {c.label}
              </span>
              {!c.isLast && <span className={styles.sep}>/</span>}
            </span>
          ))
        )}
      </nav>

      <div className={styles.spacer} />

      <button className={styles.iconBtn} aria-label="Notificaciones">
        <Bell size={15} />
        <span className={styles.dot} />
      </button>

      <button className={styles.iconBtn} aria-label="Configuración">
        <Settings size={15} />
      </button>

      {/* ── Avatar with dropdown ─────────────────────────── */}
      <div className={styles.avatarWrap} ref={menuRef}>
        <button
          className={styles.avatar}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menú de usuario"
          aria-expanded={menuOpen}
        >
          AS
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHeader}>
              <div className={styles.menuAvatar}>AS</div>
              <div className={styles.menuUserInfo}>
                <span className={styles.menuName}>Alejandro</span>
                <span className={styles.menuEmail}>
                  alejandro@maxtracker.io
                </span>
              </div>
            </div>

            <div className={styles.menuDivider} />

            <button className={styles.menuItem} role="menuitem">
              <User size={14} />
              <span className={styles.menuItemLabel}>Mi perfil</span>
            </button>

            <div className={styles.menuDivider} />

            {/* ── Modo Administrador · purple highlight ─────── */}
            <Link
              href="/admin"
              className={styles.menuAdminItem}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <div className={styles.menuAdminIcon}>
                <Shield size={14} />
              </div>
              <div className={styles.menuAdminBody}>
                <span className={styles.menuAdminTitle}>
                  Modo Administrador
                </span>
                <span className={styles.menuAdminSub}>
                  Maxtracker interno · backoffice
                </span>
              </div>
              <ChevronRight size={14} className={styles.menuAdminChev} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
