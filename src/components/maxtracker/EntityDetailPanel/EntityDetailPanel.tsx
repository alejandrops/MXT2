"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./EntityDetailPanel.module.css";

// ═══════════════════════════════════════════════════════════════
//  EntityDetailPanel · S5-T2 · panel canónico
//  ─────────────────────────────────────────────────────────────
//  Shell unificado para todos los side panels de "evento puntual"
//  · Eventos · Alarmas · Infracciones · etc.
//
//  El contenido se compone con sub-componentes que viven en este
//  mismo directorio:
//    · <PanelDataSection>     · grid de pares clave/valor
//    · <PanelMapSection>      · mini-mapa con polilínea o pin
//    · <PanelCustomSection>   · contenedor genérico (curva,
//                                charts, etc.)
//    · <PanelActionsSection>  · botones contextuales al pie
//
//  Cierre: ESC o click en backdrop o botón X.
//
//  Uso típico:
//    <EntityDetailPanel
//      open={selected !== null}
//      onClose={() => setSelected(null)}
//      kicker="Evento"
//      title="Frenado brusco"
//      subtitle="Camión AH460 · 5 may 2026, 14:32 ART"
//    >
//      <PanelDataSection rows={[...]} />
//      <PanelMapSection lat={...} lng={...} />
//      <PanelActionsSection>
//        <button>Ver en libro</button>
//      </PanelActionsSection>
//    </EntityDetailPanel>
// ═══════════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
  /** Eyebrow corta · ej. "Evento" · "Alarma" · "Infracción" */
  kicker?: string;
  /** Título principal del panel */
  title: string;
  /** Subtítulo gris (vehículo, fecha, ubicación, etc.) · acepta ReactNode */
  subtitle?: ReactNode;
  /** Color de acento del header (típicamente severity color) */
  accentColor?: string;
  children: ReactNode;
}

export function EntityDetailPanel({
  open,
  onClose,
  kicker,
  title,
  subtitle,
  accentColor,
  children,
}: Props) {
  // ESC cierra
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <aside className={styles.panel} role="dialog" aria-modal="true">
        <header
          className={styles.header}
          style={
            accentColor ? { borderTopColor: accentColor, borderTopWidth: 2 } : undefined
          }
        >
          <div className={styles.headerMain}>
            {kicker && (
              <div className={styles.kicker}>{kicker}</div>
            )}
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
}
