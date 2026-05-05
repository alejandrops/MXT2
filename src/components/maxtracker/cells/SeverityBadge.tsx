import { mapSeverityToSemantic } from "@/lib/format";
import styles from "./cells.module.css";

// ═══════════════════════════════════════════════════════════════
//  SeverityBadge · S5-T2 · canónico
//  ─────────────────────────────────────────────────────────────
//  Pill con color funcional por nivel semántico. Acepta
//  cualquier valor de severidad del dominio (LOW/MEDIUM/HIGH/
//  CRITICAL, LEVE/MEDIA/GRAVE) y mapea internamente.
//
//  Si se pasa `customLabel` lo usa como texto · si no, usa el
//  level tal cual (ej. "Leve").
// ═══════════════════════════════════════════════════════════════

interface Props {
  level: string;
  customLabel?: string;
}

const SEMANTIC_CLASS: Record<string, string> = {
  info: "sevInfo",
  warning: "sevWarning",
  danger: "sevDanger",
  critical: "sevCritical",
};

export function SeverityBadge({ level, customLabel }: Props) {
  const semantic = mapSeverityToSemantic(level);
  const className = SEMANTIC_CLASS[semantic] ?? "sevInfo";
  const label = customLabel ?? capitalize(level);

  return (
    <span className={`${styles.sevBadge} ${styles[className]}`}>{label}</span>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
