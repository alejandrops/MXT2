"use client";

import { CheckCircle2, Crown, Zap, Star } from "lucide-react";
import sharedStyles from "../ConfiguracionPage.module.css";
import styles from "./EmpresaPlanTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Plan y facturación (S1 · solo lectura)
//  ─────────────────────────────────────────────────────────────
//  Muestra el tier actual del cliente y las features incluidas.
//  Cambios de plan se hacen contactando a Maxtracker · acá no
//  hay self-service de upgrade (decisión post-MVP cuando esté
//  Stripe integrado).
// ═══════════════════════════════════════════════════════════════

interface Props {
  account: {
    id: string;
    name: string;
    tier: string;
  };
  usage: {
    vehicles: number;
    users: number;
  };
}

interface PlanFeatures {
  vehicles: number;
  users: number;
  retention: string;
  support: string;
  features: string[];
}

const PLANS: Record<string, { label: string; description: string; features: PlanFeatures; icon: React.ReactNode; accent: string }> = {
  BASE: {
    label: "Base",
    description: "Para flotas pequeñas que arrancan con telemática.",
    icon: <Star size={20} />,
    accent: "blu",
    features: {
      vehicles: 30,
      users: 5,
      retention: "30 días",
      support: "Email · respuesta en 48h",
      features: [
        "Mapa en vivo + historial",
        "Alarmas básicas (velocidad, ralentí)",
        "Reportes de viajes",
        "1 grupo de vehículos",
      ],
    },
  },
  PRO: {
    label: "Pro",
    description: "El estándar para flotas medianas que necesitan análisis.",
    icon: <Zap size={20} />,
    accent: "amb",
    features: {
      vehicles: 100,
      users: 20,
      retention: "90 días",
      support: "Email + chat · respuesta en 8h",
      features: [
        "Todo lo de Base, más:",
        "Conducción agresiva (g-force)",
        "Análisis de eficiencia y consumo",
        "Boletines automáticos",
        "Grupos jerárquicos (2 niveles)",
        "API REST (read-only)",
        "Hasta 100 conductores asignables",
      ],
    },
  },
  ENTERPRISE: {
    label: "Enterprise",
    description: "Para grandes flotas con necesidades operacionales complejas.",
    icon: <Crown size={20} />,
    accent: "grn",
    features: {
      vehicles: 9999,
      users: 9999,
      retention: "1 año",
      support: "Account manager dedicado · 24/7",
      features: [
        "Todo lo de Pro, más:",
        "Vehículos y usuarios ilimitados",
        "API REST + Webhooks",
        "Cámaras AI (cuando estén disponibles)",
        "Análisis predictivo de mantenimiento",
        "Custom reports + integraciones a medida",
        "SLA contractual con garantías",
      ],
    },
  },
};

export function EmpresaPlanTab({ account, usage }: Props) {
  const plan = PLANS[account.tier] || PLANS.BASE!;

  const vehicleLimit = plan.features.vehicles;
  const userLimit = plan.features.users;
  const vehicleIsUnlimited = vehicleLimit >= 9999;
  const userIsUnlimited = userLimit >= 9999;

  return (
    <div>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Plan y facturación</h2>
        <p className={sharedStyles.tabSubtitle}>
          Tu suscripción actual y las features incluidas.
        </p>
      </header>

      <div className={`${styles.currentPlan} ${styles[`accent_${plan.accent}`]}`}>
        <div className={styles.currentPlanHeader}>
          <div className={styles.planIcon}>{plan.icon}</div>
          <div className={styles.planTitle}>
            <div className={styles.planLabel}>Plan actual</div>
            <h3 className={styles.planName}>{plan.label}</h3>
          </div>
        </div>
        <p className={styles.planDescription}>{plan.description}</p>

        {/* ── Uso vs límite ─────────────────────────────────── */}
        <div className={styles.usageGrid}>
          <UsageBar
            label="Vehículos"
            current={usage.vehicles}
            limit={vehicleLimit}
            unlimited={vehicleIsUnlimited}
          />
          <UsageBar
            label="Usuarios"
            current={usage.users}
            limit={userLimit}
            unlimited={userIsUnlimited}
          />
        </div>

        <div className={styles.statsGrid}>
          <Stat label="Retención de datos" value={plan.features.retention} />
          <Stat label="Soporte" value={plan.features.support} short />
        </div>
      </div>

      <div className={sharedStyles.section}>
        <h3 className={sharedStyles.sectionTitle}>Features incluidas en {plan.label}</h3>

        <ul className={styles.featuresList}>
          {plan.features.features.map((f, i) => (
            <li key={i} className={styles.featureItem}>
              <CheckCircle2 size={14} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.upgradeCard}>
        <div>
          <strong>¿Necesitás más capacidad o un plan superior?</strong>
          <p>Contactá a tu account manager o escribinos a <a href="mailto:hola@maxtracker.com">hola@maxtracker.com</a>.</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, short }: { label: string; value: string; short?: boolean }) {
  return (
    <div className={`${styles.stat} ${short ? styles.statShort : ""}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

function UsageBar({
  label,
  current,
  limit,
  unlimited,
}: {
  label: string;
  current: number;
  limit: number;
  unlimited: boolean;
}) {
  if (unlimited) {
    return (
      <div className={styles.usageItem}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>{label}</span>
          <span className={styles.usageValue}>
            <strong>{current}</strong> / Ilimitado
          </span>
        </div>
      </div>
    );
  }

  const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const status =
    percent >= 100 ? "full" : percent >= 80 ? "warning" : "ok";

  return (
    <div className={styles.usageItem}>
      <div className={styles.usageHeader}>
        <span className={styles.usageLabel}>{label}</span>
        <span className={styles.usageValue}>
          <strong>{current}</strong> / {limit}
        </span>
      </div>
      <div className={styles.usageBar}>
        <div
          className={`${styles.usageBarFill} ${styles[`usageBarFill_${status}`]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {status === "warning" && (
        <div className={styles.usageWarn}>
          Estás cerca del límite del plan.
        </div>
      )}
      {status === "full" && (
        <div className={styles.usageWarn}>
          Llegaste al límite del plan. Contactá soporte para upgradear.
        </div>
      )}
    </div>
  );
}
