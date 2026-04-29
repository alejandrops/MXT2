"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Bell,
  ChevronRight,
  Repeat,
  Settings,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { switchIdentity } from "@/lib/actions/session-actions";
import type { SessionData } from "@/lib/session";
import styles from "./Topbar.module.css";

// ═══════════════════════════════════════════════════════════════
//  Topbar — context row above page content
//  ─────────────────────────────────────────────────────────────
//  Avatar dropdown · 3 entry points:
//    · Mi perfil → /configuracion
//    · Cambiar identidad demo (submenu) · solo demo, post-Auth0 fuera
//    · Modo Administrador → /admin
//
//  Lote F1: la sesión viene como prop desde el layout server
//  component. El identity switcher dispara una server action que
//  setea la cookie y revalida.
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
  reportes: "Reportes",
  correlaciones: "Correlaciones",
  boletin: "Boletín",
  "vista-ejecutiva": "Vista ejecutiva",
  "distribucion-grupos": "Distribución por grupo",
};

interface DemoIdentity {
  id: string;
  fullName: string;
  email: string;
  profileKey: string;
  profileLabel: string;
  accountName: string | null;
}

interface Props {
  session: SessionData;
  demoIdentities: DemoIdentity[];
}

export function Topbar({ session, demoIdentities }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const [menuOpen, setMenuOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setIdentityOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setIdentityOpen(false);
      }
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

  function handleSwitchIdentity(userId: string) {
    if (userId === session.user.id) {
      // misma identidad · solo cerrar menú
      setIdentityOpen(false);
      setMenuOpen(false);
      return;
    }
    startTransition(async () => {
      await switchIdentity(userId);
      setIdentityOpen(false);
      setMenuOpen(false);
      router.refresh();
    });
  }

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
          style={{ background: session.user.avatarColor }}
          onClick={() => {
            setMenuOpen((v) => !v);
            setIdentityOpen(false);
          }}
          aria-label="Menú de usuario"
          aria-expanded={menuOpen}
        >
          {session.user.initials}
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHeader}>
              <div
                className={styles.menuAvatar}
                style={{ background: session.user.avatarColor }}
              >
                {session.user.initials}
              </div>
              <div className={styles.menuUserInfo}>
                <span className={styles.menuName}>
                  {session.user.fullName}
                </span>
                <span className={styles.menuEmail}>
                  {session.user.email}
                </span>
                <span className={styles.menuRoleLine}>
                  {session.profile.nameLabel}
                  {session.account && (
                    <>
                      <span className={styles.menuRoleSep}> · </span>
                      {session.account.name}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className={styles.menuDivider} />

            <Link
              href="/configuracion"
              className={styles.menuItem}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <User size={14} />
              <span className={styles.menuItemLabel}>Mi perfil</span>
            </Link>

            {/* ── Switcher de identidad demo ─────────────── */}
            <button
              className={styles.menuItem}
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setIdentityOpen((v) => !v);
              }}
              disabled={isPending}
            >
              <Repeat size={14} />
              <span className={styles.menuItemLabel}>
                Cambiar identidad demo
              </span>
              <ChevronRight size={12} className={styles.menuItemChev} />
            </button>

            {identityOpen && (
              <div className={styles.identityList} role="menu">
                {demoIdentities.map((id) => (
                  <button
                    key={id.id}
                    className={`${styles.identityItem} ${
                      id.id === session.user.id
                        ? styles.identityItemActive
                        : ""
                    }`}
                    onClick={() => handleSwitchIdentity(id.id)}
                    disabled={isPending}
                  >
                    <div className={styles.identityHeading}>
                      <span className={styles.identityName}>
                        {id.fullName}
                      </span>
                      {id.id === session.user.id && (
                        <span className={styles.identityActiveBadge}>
                          actual
                        </span>
                      )}
                    </div>
                    <div className={styles.identitySub}>
                      <span>{id.profileLabel}</span>
                      {id.accountName && (
                        <>
                          <span className={styles.identitySep}> · </span>
                          <span>{id.accountName}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.menuDivider} />

            {/* ── Modo Administrador · purple highlight ───── */}
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
