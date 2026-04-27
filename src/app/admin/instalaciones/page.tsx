import { Wrench, ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "../placeholder.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/instalaciones · Placeholder
//  ─────────────────────────────────────────────────────────────
//  This page will track installation lifecycle: self-install kits
//  shipped, devices first-connected but not yet assigned, OK
//  installations, and failures.
//
//  Doesn't strictly need a new model · most state can live on
//  Device (status: PENDING_ASSIGNMENT | ASSIGNED | RETIRED) plus
//  optional InstallationEvent rows.
// ═══════════════════════════════════════════════════════════════

export default function InstalacionesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <Wrench size={28} className={styles.icon} />
        </div>
        <h1 className={styles.title}>Instalaciones</h1>
        <p className={styles.subtitle}>
          Próximamente · seguimiento de instalaciones self-install y
          asignaciones pendientes
        </p>

        <div className={styles.divider} />

        <div className={styles.specs}>
          <span className={styles.specsLabel}>Esta pantalla incluirá</span>
          <ul className={styles.specsList}>
            <li>
              Self-install · IMEIs que conectaron por primera vez sin
              vehículo asignado
            </li>
            <li>Asignaciones en curso · técnico, fecha programada</li>
            <li>
              Instalaciones completadas con QA aprobado · últimos 30 días
            </li>
            <li>Fallas · diagnóstico y motivo de retiro del campo</li>
            <li>
              Tiempo medio entre primera conexión y asignación efectiva
            </li>
          </ul>
        </div>

        <div className={styles.specs}>
          <span className={styles.specsLabel}>
            Cambios técnicos pendientes
          </span>
          <ul className={styles.specsList}>
            <li>
              Agregar campo <code>Device.status</code> ·{" "}
              <code>PENDING_ASSIGNMENT | ASSIGNED | RETIRED</code>
            </li>
            <li>
              Modelo opcional <code>InstallationEvent</code> · timeline de
              cambios
            </li>
          </ul>
        </div>

        <Link href="/admin" className={styles.backLink}>
          <ArrowLeft size={13} />
          Volver al dashboard
        </Link>
      </div>
    </div>
  );
}
