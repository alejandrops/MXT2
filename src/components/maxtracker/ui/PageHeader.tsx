"use client";

import { BackButton } from "./BackButton";
import { HelpButton } from "@/components/help/HelpButton";
import styles from "./PageHeader.module.css";

// ═══════════════════════════════════════════════════════════════
//  PageHeader · 2 variants
//  ─────────────────────────────────────────────────────────────
//  Variant "module" · header de pantalla común de un módulo
//    AG017HZ - VISTA EJECUTIVA
//    Octubre 2025 · 30 días                      [acciones]
//
//  Variant "object" · header del Libro del Objeto
//    ← Vehículos
//    AG017HZ · Iveco Daily 35S15        ● En movimiento
//    Patente ABC-123 · Grupo Sur · Camión chico
//                                          [acciones]
//
//  Tufte aplicado · sin sombras · sin iconos decorativos · color
//  solo en estado vivo (semáforo).
// ═══════════════════════════════════════════════════════════════

export type ObjectStatus =
  | "moving"
  | "stopped"
  | "off"
  | "no-signal"
  | "unknown";

const STATUS_LABELS: Record<ObjectStatus, string> = {
  moving: "En movimiento",
  stopped: "Detenido",
  off: "Apagado",
  "no-signal": "Sin reportar",
  unknown: "Estado desconocido",
};

interface ModuleHeaderProps {
  variant: "module";
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /**
   * Slug de la wiki para esta vista · si se pasa, se renderiza
   * un botón "?" a la derecha que abre el HelpDrawer asociado.
   * Convención · matching con docs/wiki/{slug}.mdx
   */
  helpSlug?: string;
}

interface ObjectHeaderProps {
  variant: "object";
  /** Tipo del objeto · "Vehículo" / "Conductor" / "Grupo" */
  objectType: string;
  /** Nombre principal · ej "AG017HZ" */
  objectName: string;
  /** Subtítulo descriptivo · ej "Iveco Daily 35S15" */
  objectSubtitle?: string;
  /** Línea metadata · ej "Patente ABC-123 · Grupo Sur · Camión chico" */
  metadata?: string;
  /** Estado actual · solo para vehículos · null para conductor/grupo */
  status?: ObjectStatus | null;
  /** Etiqueta del breadcrumb · ej "Vehículos" */
  backLabel?: string;
  /** URL del breadcrumb · ej "/catalogos/vehiculos" */
  backHref?: string;
  /** Acciones rápidas a la derecha */
  actions?: React.ReactNode;
  /**
   * Slug de la wiki para esta vista · si se pasa, se renderiza
   * un botón "?" a la derecha que abre el HelpDrawer asociado.
   * Convención · matching con docs/wiki/{slug}.mdx
   */
  helpSlug?: string;
}

type Props = ModuleHeaderProps | ObjectHeaderProps;

export function PageHeader(props: Props) {
  if (props.variant === "module") {
    return <ModuleHeader {...props} />;
  }
  return <ObjectHeader {...props} />;
}

function ModuleHeader({ title, subtitle, actions, helpSlug }: ModuleHeaderProps) {
  return (
    <header className={styles.module}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
      </div>
      {(actions || helpSlug) && (
        <div className={styles.actions}>
          {actions}
          {helpSlug && <HelpButton slug={helpSlug} />}
        </div>
      )}
    </header>
  );
}

function ObjectHeader({
  objectType,
  objectName,
  objectSubtitle,
  metadata,
  status,
  backLabel,
  backHref,
  actions,
  helpSlug,
}: ObjectHeaderProps) {
  return (
    <header className={styles.object}>
      {backLabel && backHref && (
        // L4 · BackButton dinámico · navega al lugar de origen real
        // (último entry del stack en sessionStorage). Si el stack
        // está vacío, cae a backHref (comportamiento previo).
        <BackButton
          fallbackUrl={backHref}
          defaultLabel={backLabel}
        />
      )}
      <div className={styles.row}>
        <div className={styles.left}>
          <div className={styles.objectTypeLabel}>{objectType}</div>
          <div className={styles.objectMain}>
            <h1 className={styles.objectName}>{objectName}</h1>
            {objectSubtitle && (
              <span className={styles.objectSubtitle}>· {objectSubtitle}</span>
            )}
            {status && <StatusPill status={status} />}
          </div>
          {metadata && <div className={styles.metadata}>{metadata}</div>}
        </div>
        {(actions || helpSlug) && (
          <div className={styles.actions}>
            {actions}
            {helpSlug && <HelpButton slug={helpSlug} />}
          </div>
        )}
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: ObjectStatus }) {
  const cls = `${styles.statusPill} ${styles[`status_${status.replace("-", "_")}`]}`;
  return (
    <span className={cls}>
      <span className={styles.statusDot} />
      {STATUS_LABELS[status]}
    </span>
  );
}
