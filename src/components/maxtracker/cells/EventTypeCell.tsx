import { EVENT_TYPE_LABEL } from "@/lib/format";
import type { EventType } from "@/types/domain";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  EventTypeCell · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Dot circular con color funcional + label en español. La
//  paleta de colores la decide el módulo · si no se pasa color,
//  usa neutral gris.
//
//  Por qué inline color y no color por tipo: el mapping
//  type→color depende del módulo (Conducción usa otra paleta
//  que Seguridad). Cada pantalla pasa el color que corresponda.
// ═══════════════════════════════════════════════════════════════

interface Props {
  type: EventType;
  color?: string;
  customLabel?: string;
}

export function EventTypeCell({
  type,
  color = "#94a3b8",
  customLabel,
}: Props) {
  const label = customLabel ?? EVENT_TYPE_LABEL[type] ?? type;
  return (
    <span className={styles.eventType}>
      <span
        className={styles.eventDot}
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
