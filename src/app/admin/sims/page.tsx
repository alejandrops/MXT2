import { CircleSlash, ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "../placeholder.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/sims · Placeholder
//  ─────────────────────────────────────────────────────────────
//  This page will manage SIM cards: ICCID, plan, carrier, data
//  usage, expiration, and the device the SIM is installed in.
//  Schema models needed:
//    · Sim (iccid, msisdn, carrier, planMb, expiresAt, status)
//    · SimProvider (Claro, Personal, Movistar, etc.)
//
//  Rendered as a placeholder until the schema lands · keeps the
//  navigation surface complete for stakeholder demos.
// ═══════════════════════════════════════════════════════════════

export default function SimsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <CircleSlash size={28} className={styles.icon} />
        </div>
        <h1 className={styles.title}>Líneas SIM</h1>
        <p className={styles.subtitle}>
          Próximamente · gestión de planes, vencimientos y uso de datos
        </p>

        <div className={styles.divider} />

        <div className={styles.specs}>
          <span className={styles.specsLabel}>Esta pantalla incluirá</span>
          <ul className={styles.specsList}>
            <li>Inventario de líneas con ICCID y número MSISDN</li>
            <li>Operadora (Claro, Personal, Movistar) y plan contratado</li>
            <li>Uso de datos del mes y % consumido del plan</li>
            <li>Fechas de alta y vencimiento por línea</li>
            <li>Dispositivo asignado y cliente al que pertenece</li>
            <li>Alertas: SIMs próximas a vencer, planes excedidos</li>
          </ul>
        </div>

        <div className={styles.specs}>
          <span className={styles.specsLabel}>
            Modelos de datos pendientes
          </span>
          <ul className={styles.specsList}>
            <li>
              <code>Sim</code> · iccid, msisdn, carrier, planMb, status,
              expiresAt
            </li>
            <li>
              <code>SimUsage</code> · daily snapshots por línea
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
