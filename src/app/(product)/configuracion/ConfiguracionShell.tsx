"use client";

import { useRouter } from "next/navigation";
import {
  User,
  Bell,
  Sliders,
  Lock,
  Building2,
  Gauge,
  Plug,
  CreditCard,
  Users,
} from "lucide-react";
import type { SessionData } from "@/lib/session";
import type { SectionKey } from "./page";
import { MiPerfilTab } from "./MiPerfilTab";
import { NotificacionesTab } from "./NotificacionesTab";
import { PreferenciasTab } from "./PreferenciasTab";
import { SeguridadTab } from "./SeguridadTab";
import { EmpresaDatosTab } from "./empresa/EmpresaDatosTab";
import { EmpresaUmbralesTab } from "./empresa/EmpresaUmbralesTab";
import { EmpresaIntegracionesTab } from "./empresa/EmpresaIntegracionesTab";
import { EmpresaPlanTab } from "./empresa/EmpresaPlanTab";
import { EmpresaUsuariosTab } from "./empresa/EmpresaUsuariosTab";
import { AccountSwitcher } from "./empresa/AccountSwitcher";
import styles from "./ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  ConfiguracionShell · sidebar lateral + content del section
//  ─────────────────────────────────────────────────────────────
//  Patrón Notion/Linear: sidebar con groups colapsables (visual,
//  no funcionales · siempre expanded). Click en item → router push
//  a /configuracion?section=...
// ═══════════════════════════════════════════════════════════════

interface AccountWithSettings {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  tier: string;
  organizationId: string;
  settings: {
    id: string;
    speedLimitUrban: number;
    speedLimitHighway: number;
    speedTolerancePercent: number;
    harshBrakingThreshold: number;
    harshAccelerationThreshold: number;
    harshCorneringThreshold: number;
    idlingMinDuration: number;
    tripMinDistanceKm: number;
    tripMinDurationSec: number;
    alertContactEmail: string | null;
    alertContactPhone: string | null;
    integrations: unknown;
    planOverrides: unknown;
  } | null;
}

interface AccountUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  profileId: string;
  profile: {
    id: string;
    systemKey: string;
    nameLabel: string;
  };
}

interface AssignableProfile {
  id: string;
  systemKey: string;
  nameLabel: string;
}

interface Props {
  session: SessionData;
  activeSection: SectionKey;
  canSeeEmpresa: boolean;
  account: AccountWithSettings | null;
  accountUsers: AccountUser[] | null;
  assignableProfiles: AssignableProfile[] | null;
  usage: { vehicles: number; users: number } | null;
  // S5 · selector de cuenta para SA/MA
  availableAccounts: { id: string; name: string; slug: string }[];
  targetAccountId: string | null;
  isPlatformAdmin: boolean;
}

interface SectionDef {
  key: SectionKey;
  label: string;
  icon: React.ReactNode;
}

interface SectionGroup {
  label: string;
  sections: SectionDef[];
}

export function ConfiguracionShell({
  session,
  activeSection,
  canSeeEmpresa,
  account,
  accountUsers,
  assignableProfiles,
  usage,
  availableAccounts,
  targetAccountId,
  isPlatformAdmin,
}: Props) {
  const router = useRouter();

  function navigate(key: SectionKey) {
    if (key === activeSection) return;
    // Preservar account param si existe (caso SA/MA)
    const params = new URLSearchParams();
    params.set("section", key);
    if (targetAccountId && isPlatformAdmin) {
      params.set("account", targetAccountId);
    }
    router.push(`/configuracion?${params.toString()}`);
  }

  const groups: SectionGroup[] = [
    {
      label: "Mi cuenta",
      sections: [
        { key: "perfil", label: "Mi perfil", icon: <User size={14} /> },
        { key: "notificaciones", label: "Notificaciones", icon: <Bell size={14} /> },
        { key: "preferencias", label: "Preferencias", icon: <Sliders size={14} /> },
        { key: "seguridad", label: "Seguridad", icon: <Lock size={14} /> },
      ],
    },
  ];

  if (canSeeEmpresa) {
    groups.push({
      label: "Empresa",
      sections: [
        { key: "empresa-datos", label: "Datos de la cuenta", icon: <Building2 size={14} /> },
        { key: "empresa-umbrales", label: "Umbrales y alarmas", icon: <Gauge size={14} /> },
        { key: "empresa-integraciones", label: "Integraciones", icon: <Plug size={14} /> },
        { key: "empresa-plan", label: "Plan y facturación", icon: <CreditCard size={14} /> },
        { key: "empresa-usuarios", label: "Usuarios y permisos", icon: <Users size={14} /> },
      ],
    });
  }

  return (
    <div className={styles.shell}>
      {/* ── Sidebar contextual ─────────────────────────────── */}
      <nav className={styles.sidebar} aria-label="Configuración">
        <div className={styles.sidebarHeader}>
          <h1 className={styles.sidebarTitle}>Configuración</h1>
        </div>
        {groups.map((group) => {
          const isEmpresaGroup = group.label === "Empresa";
          return (
            <div key={group.label} className={styles.sidebarGroup}>
              <div className={styles.sidebarGroupLabel}>{group.label}</div>

              {/* S5 · Switcher de cuenta arriba del grupo Empresa para SA/MA */}
              {isEmpresaGroup && isPlatformAdmin && availableAccounts.length > 0 && (
                <AccountSwitcher
                  accounts={availableAccounts}
                  currentAccountId={targetAccountId}
                />
              )}

              {group.sections.map((section) => {
                const isActive = section.key === activeSection;
                return (
                  <button
                    key={section.key}
                    type="button"
                    className={`${styles.sidebarItem} ${
                      isActive ? styles.sidebarItemActive : ""
                    }`}
                    onClick={() => navigate(section.key)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className={styles.sidebarItemIcon}>{section.icon}</span>
                    <span className={styles.sidebarItemLabel}>{section.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Content area ───────────────────────────────────── */}
      <main className={styles.content}>
        {renderSection(
          activeSection,
          session,
          account,
          accountUsers,
          assignableProfiles,
          usage,
        )}
      </main>
    </div>
  );
}

function renderSection(
  section: SectionKey,
  session: SessionData,
  account: AccountWithSettings | null,
  accountUsers: AccountUser[] | null,
  assignableProfiles: AssignableProfile[] | null,
  usage: { vehicles: number; users: number } | null,
) {
  switch (section) {
    case "perfil":
      return <MiPerfilTab session={session} />;
    case "notificaciones":
      return <NotificacionesTab session={session} />;
    case "preferencias":
      return <PreferenciasTab session={session} />;
    case "seguridad":
      return <SeguridadTab session={session} />;
    case "empresa-datos":
      return account ? (
        <EmpresaDatosTab account={account} />
      ) : (
        <EmptyState text="No se pudo cargar la información de la cuenta." />
      );
    case "empresa-umbrales":
      return account ? (
        <EmpresaUmbralesTab account={account} />
      ) : (
        <EmptyState text="No se pudo cargar la configuración de umbrales." />
      );
    case "empresa-integraciones":
      return account ? (
        <EmpresaIntegracionesTab account={account} />
      ) : (
        <EmptyState text="No se pudo cargar las integraciones." />
      );
    case "empresa-plan":
      return account && usage ? (
        <EmpresaPlanTab account={account} usage={usage} />
      ) : (
        <EmptyState text="No se pudo cargar el plan." />
      );
    case "empresa-usuarios":
      return account && accountUsers && assignableProfiles ? (
        <EmpresaUsuariosTab
          account={account}
          users={accountUsers}
          assignableProfiles={assignableProfiles}
          currentUserId={session.user.id}
        />
      ) : (
        <EmptyState text="No se pudo cargar la lista de usuarios." />
      );
    default:
      return <EmptyState text="Sección no encontrada." />;
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={styles.emptyState}>
      <p>{text}</p>
    </div>
  );
}
