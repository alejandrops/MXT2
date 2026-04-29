"use client";

import { useRouter } from "next/navigation";
import { User, Bell, Sliders, Lock, Building2 } from "lucide-react";
import type { SessionData } from "@/lib/session";
import type { TabKey } from "./page";
import { MiPerfilTab } from "./MiPerfilTab";
import { PreferenciasTab } from "./PreferenciasTab";
import { NotificacionesTab } from "./NotificacionesTab";
import { SeguridadTab } from "./SeguridadTab";
import { MiCuentaTab } from "./MiCuentaTab";
import styles from "./ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  ConfiguracionClient · sidebar de tabs + contenido del tab
//  ─────────────────────────────────────────────────────────────
//  Click en tab → router.push(`?tab=...`) · server re-render
//  con el tab nuevo. Más simple que useState porque permite
//  bookmark + back button.
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
  activeTab: TabKey;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  /** Si true, el tab existe en el navigator pero su contenido es
   *  un placeholder "Próximamente" (lote A2). */
  comingSoon?: boolean;
}

const TABS: TabDef[] = [
  { key: "perfil", label: "Mi perfil", icon: <User size={14} /> },
  { key: "notificaciones", label: "Notificaciones", icon: <Bell size={14} /> },
  { key: "preferencias", label: "Preferencias", icon: <Sliders size={14} /> },
  { key: "seguridad", label: "Seguridad", icon: <Lock size={14} /> },
  { key: "cuenta", label: "Mi cuenta", icon: <Building2 size={14} /> },
];

export function ConfiguracionClient({ session, activeTab }: Props) {
  const router = useRouter();

  function navigate(key: TabKey) {
    if (key === activeTab) return;
    router.push(`/configuracion?tab=${key}`);
  }

  const tabContent = renderTab(activeTab, session);

  return (
    <div className={styles.layout}>
      {/* ── Sidebar de tabs ────────────────────────────── */}
      <aside className={styles.tabsAside}>
        <div className={styles.userCard}>
          <div
            className={styles.userAvatar}
            style={{ background: session.user.avatarColor }}
          >
            {session.user.initials}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {session.user.fullName}
            </span>
            <span className={styles.userRole}>
              {session.profile.nameLabel}
            </span>
            {session.account && (
              <span className={styles.userAccount}>
                {session.account.name}
              </span>
            )}
          </div>
        </div>

        <nav className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tabBtn} ${
                tab.key === activeTab ? styles.tabBtnActive : ""
              }`}
              onClick={() => navigate(tab.key)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.comingSoon && (
                <span className={styles.tabBadge}>pronto</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Contenido del tab activo ───────────────────── */}
      <section className={styles.tabContent}>{tabContent}</section>
    </div>
  );
}

function renderTab(tab: TabKey, session: SessionData): React.ReactNode {
  switch (tab) {
    case "perfil":
      return <MiPerfilTab session={session} />;
    case "notificaciones":
      return <NotificacionesTab session={session} />;
    case "preferencias":
      return <PreferenciasTab session={session} />;
    case "seguridad":
      return <SeguridadTab session={session} />;
    case "cuenta":
      return <MiCuentaTab session={session} />;
  }
}
