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

export function EmpresaPlanTab({ account }: Props) {
  const plan = PLANS[account.tier] || PLANS.BASE!;

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

        <div className={styles.statsGrid}>
          <Stat label="Vehículos incluidos" value={plan.features.vehicles >= 9999 ? "Ilimitados" : plan.features.vehicles.toString()} />
          <Stat label="Usuarios incluidos" value={plan.features.users >= 9999 ? "Ilimitados" : plan.features.users.toString()} />
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
