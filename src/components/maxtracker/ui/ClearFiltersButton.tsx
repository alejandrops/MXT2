"use client";

import Link from "next/link";
import { X } from "lucide-react";
import styles from "./ClearFiltersButton.module.css";

// ═══════════════════════════════════════════════════════════════
//  ClearFiltersButton · L8
//  ─────────────────────────────────────────────────────────────
//  Botón "Limpiar filtros" pensado para usar como `action` en
//  <EmptyState />.
//
//  Recibe el `href` ya armado por la página (URL sin filtros).
//  La página sabe cuál es su URL base · el componente solo
//  renderiza.
//
//  Uso:
//    <EmptyState
//      title="Sin vehículos para los filtros aplicados"
//      hint="Probá ampliar el rango o quitar restricciones."
//      action={<ClearFiltersButton href="/actividad/viajes" />}
//    />
// ═══════════════════════════════════════════════════════════════

interface Props {
  /** URL base sin querystring · clear lleva ahí */
  href: string;
  /** Override visual · default "Limpiar filtros" */
  label?: string;
}

export function ClearFiltersButton({ href, label = "Limpiar filtros" }: Props) {
  return (
    <Link href={href} className={styles.btn}>
      <X size={11} />
      {label}
    </Link>
  );
}
