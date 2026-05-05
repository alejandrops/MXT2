"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, Home, Settings, Shield, User, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationsBell } from "./NotificationsBell";
import styles from "./Topbar.module.css";

// ═══════════════════════════════════════════════════════════════
//  Topbar — context row above page content
//  ─────────────────────────────────────────────────────────────
//  Breadcrumb derives from pathname. Avatar dropdown shows real
//  user info (name + email + profile) and exposes:
//    · Mi perfil (link a /configuracion?section=perfil)
//    · Modo Administrador (solo SA / MA)
//    · Cerrar sesión (POST a /auth/signout)
// ═══════════════════════════════════════════════════════════════

const MODULE_LABELS: Record<string, string> = {
  seguridad: "Seguridad",
  seguimiento: "Seguimiento",
  gestion: "Gestión",
  catalogos: "Catálogos",
  conduccion: "Conducción",
  logistica: "Logística",
  combustible: "Combustible",
  mantenimiento: "Mantenimiento",
  documentacion: "Documentación",
  sostenibilidad: "Sostenibilidad",
  direccion: "Dirección",
  actividad: "Actividad",
  configuracion: "Configuración",
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
  scorecard: "Scorecard",
  evolucion: "Evolución",
  resumen: "Resumen",
  configuracion: "Configuración",
  empresa: "Empresa",
  perfil: "Mi perfil",
  seguridad: "Seguridad",
  preferencias: "Preferencias",
  catalogos: "Catálogos",
  seguimiento: "Seguimiento",
  actividad: "Actividad",
  direccion: "Dirección",
  boletin: "Boletín",
  // S1-L2 ia-reorg · vista-ejecutiva se eliminó (redirige a /dashboard).
  // distribucion-grupos quedó como redirect a comparativa-objetos.
  "comparativa-objetos": "Comparativa entre objetos",
  conduccion: "Conducción",
};

interface TopbarUser {
  firstName: string;
  lastName: string;
  email: string;
  profileLabel: string;
}

interface Props {
  user: TopbarUser;
  isSuperAdmin: boolean;
}

export function Topbar({ user, isSuperAdmin }: Props) {
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

  // Iniciales
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

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

      {/* S1-L2 ia-reorg · link al Dashboard cross-módulo · home del sistema */}
      <Link
        href="/dashboard"
        className={styles.iconBtn}
        aria-label="Dashboard · estado actual de la flota"
        title="Dashboard"
      >
        <Home size={15} />
      </Link>

      <NotificationsBell buttonClass={styles.iconBtn!} />

      <Link href="/configuracion" className={styles.iconBtn} aria-label="Configuración">
        <Settings size={15} />
      </Link>

      {/* ── Avatar with dropdown ─────────────────────────── */}
      <div className={styles.avatarWrap} ref={menuRef}>
        <button
          className={styles.avatar}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menú de usuario"
          aria-expanded={menuOpen}
        >
          {initials}
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHeader}>
              <div className={styles.menuAvatar}>{initials}</div>
              <div className={styles.menuUserInfo}>
                <span className={styles.menuName}>
                  {user.firstName} {user.lastName}
                </span>
                <span className={styles.menuEmail}>{user.email}</span>
                <span className={styles.menuProfile}>{user.profileLabel}</span>
              </div>
            </div>

            <div className={styles.menuDivider} />

            <Link
              href="/configuracion?section=perfil"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <User size={14} />
              <span className={styles.menuItemLabel}>Mi perfil</span>
            </Link>

            {isSuperAdmin && (
              <>
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
              </>
            )}

            <div className={styles.menuDivider} />

            {/* ── Logout · POST a /auth/signout ────────────── */}
            <form action="/auth/signout" method="POST" style={{ margin: 0 }}>
              <button
                type="submit"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                role="menuitem"
              >
                <LogOut size={14} />
                <span className={styles.menuItemLabel}>Cerrar sesión</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
