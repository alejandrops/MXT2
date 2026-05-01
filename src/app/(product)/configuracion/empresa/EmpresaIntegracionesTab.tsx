"use client";

import { Plug, CheckCircle2, Plus } from "lucide-react";
import sharedStyles from "../ConfiguracionPage.module.css";
import styles from "./EmpresaIntegracionesTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Integraciones (S1)
//  ─────────────────────────────────────────────────────────────
//  Lista las integraciones disponibles. Por ahora placeholder ·
//  la única "integración" real es flespi (que se gestiona desde
//  /admin/clientes por SA · es decisión de Maxtracker, no del
//  cliente).
//
//  En el futuro acá vivirán:
//   · API keys del cliente para webhooks salientes
//   · OAuth con plataformas (Google Calendar, Slack, etc.)
//   · Importación de catálogos (CSV de vehículos, conductores)
// ═══════════════════════════════════════════════════════════════

interface Props {
  account: {
    id: string;
    integrations?: unknown;
  };
}

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  status: "active" | "available" | "coming_soon";
  icon: React.ReactNode;
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    id: "flespi",
    name: "Flespi",
    description:
      "Recepción de telemetría desde devices Teltonika via stream HTTPS. Configurado y gestionado por Maxtracker.",
    status: "active",
    icon: <Plug size={18} />,
  },
  {
    id: "webhooks",
    name: "Webhooks salientes",
    description:
      "Enviá eventos de tu flota a tus propios sistemas (alarmas, viajes finalizados, etc.) en tiempo real.",
    status: "coming_soon",
    icon: <Plug size={18} />,
  },
  {
    id: "api-rest",
    name: "API REST",
    description:
      "Consultá tu data programáticamente desde otros sistemas con tokens de acceso.",
    status: "coming_soon",
    icon: <Plug size={18} />,
  },
  {
    id: "csv-import",
    name: "Importación de catálogos",
    description:
      "Subí CSVs masivos de vehículos, conductores o grupos para alta inicial o actualizaciones.",
    status: "coming_soon",
    icon: <Plug size={18} />,
  },
];

export function EmpresaIntegracionesTab({ account }: Props) {
  return (
    <div>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Integraciones</h2>
        <p className={sharedStyles.tabSubtitle}>
          Conectá Maxtracker con otros sistemas y servicios.
        </p>
      </header>

      <div className={styles.grid}>
        {INTEGRATIONS.map((it) => (
          <div key={it.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>{it.icon}</div>
              <StatusBadge status={it.status} />
            </div>
            <h3 className={styles.cardTitle}>{it.name}</h3>
            <p className={styles.cardDescription}>{it.description}</p>

            <div className={styles.cardActions}>
              {it.status === "active" && (
                <button className={sharedStyles.btnSecondary} disabled>
                  <CheckCircle2 size={14} />
                  Configurada
                </button>
              )}
              {it.status === "coming_soon" && (
                <button className={sharedStyles.btnSecondary} disabled>
                  Próximamente
                </button>
              )}
              {it.status === "available" && (
                <button className={sharedStyles.btnPrimary}>
                  <Plus size={14} />
                  Conectar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: IntegrationCard["status"] }) {
  if (status === "active") {
    return (
      <span className={`${styles.badge} ${styles.badgeActive}`}>
        <span className={styles.badgeDot} />
        Activa
      </span>
    );
  }
  if (status === "coming_soon") {
    return <span className={`${styles.badge} ${styles.badgeSoon}`}>Próximamente</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeAvailable}`}>Disponible</span>;
}
