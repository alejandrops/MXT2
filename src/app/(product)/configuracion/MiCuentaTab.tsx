"use client";

import Link from "next/link";
import { Building2, Briefcase, Award, ShieldCheck, Mail } from "lucide-react";
import type { SessionData } from "@/lib/session";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./MiCuentaTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab "Mi cuenta" · información read-only
//  ─────────────────────────────────────────────────────────────
//  Muestra organización, cliente, plan, perfil de permisos, email.
//  Para cambiar datos personales, link a "Mi perfil".
//  Para cambiar plan o gestionar usuarios del cliente · link a
//  Modo Administrador (solo si tiene permisos).
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
}

const TIER_LABEL: Record<string, string> = {
  BASE: "Base",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const PROFILE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN:
    "Acceso completo a la plataforma · podés gestionar todos los clientes y configurar el sistema.",
  MAXTRACKER_ADMIN:
    "Personal interno de Maxtracker · gestionás clientes, dispositivos y líneas SIM.",
  CLIENT_ADMIN:
    "Administrás los datos de tu cliente · vehículos, conductores, grupos y operadores.",
  OPERATOR:
    "Acceso de solo lectura a la operación de tu cliente · podés ver pero no modificar.",
};

export function MiCuentaTab({ session }: Props) {
  const isCrossAccount = session.account === null;
  const profileDescription =
    PROFILE_DESCRIPTIONS[session.profile.systemKey] ?? "";

  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Mi cuenta</h2>
        <p className={sharedStyles.tabSubtitle}>
          Información de la organización y tu rol en la plataforma.
        </p>
      </header>

      <dl className={styles.infoList}>
        <InfoRow
          icon={<Building2 size={16} />}
          label="Organización"
          value={session.organization.name}
        />

        <InfoRow
          icon={<Briefcase size={16} />}
          label="Cliente"
          value={
            isCrossAccount
              ? "Acceso a todos los clientes"
              : session.account!.name
          }
          hint={
            isCrossAccount
              ? "Como personal de Maxtracker no estás asignado a un cliente específico."
              : undefined
          }
        />

        {!isCrossAccount && session.account && (
          <InfoRow
            icon={<Award size={16} />}
            label="Plan"
            value={TIER_LABEL[session.account.tier] ?? session.account.tier}
          />
        )}

        <InfoRow
          icon={<ShieldCheck size={16} />}
          label="Mi perfil"
          value={session.profile.nameLabel}
          hint={profileDescription}
        />

        <InfoRow
          icon={<Mail size={16} />}
          label="Email de contacto"
          value={session.user.email}
        />
      </dl>

      <div className={styles.actions}>
        <Link
          href="/configuracion?tab=perfil"
          className={styles.actionLinkPrimary}
        >
          Editar mi perfil
        </Link>
        <span className={styles.actionsHint}>
          Para cambiar tu nombre, email o teléfono andá a la solapa{" "}
          <strong>Mi perfil</strong>.
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  InfoRow · una fila label + valor (con icono y hint opcional)
// ═══════════════════════════════════════════════════════════════

function InfoRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <div className={styles.infoBody}>
        <dt className={styles.infoLabel}>{label}</dt>
        <dd className={styles.infoValue}>{value}</dd>
        {hint && <p className={styles.infoHint}>{hint}</p>}
      </div>
    </div>
  );
}
