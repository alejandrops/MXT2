"use client";

import Link from "next/link";
import type { ModuleDef, ModuleKey } from "@/lib/object-modules";
import styles from "./ModuleTabs.module.css";

// ═══════════════════════════════════════════════════════════════
//  ModuleTabs · tabs horizontales del Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  Capa 3 del Libro · permite cambiar entre módulos manteniendo
//  el período y filtros activos.
//
//  Tabs habilitadas son links navegables · tabs deshabilitadas
//  ("Próximamente") quedan visibles pero sin click · indicación
//  honesta de qué viene en futuras fases.
// ═══════════════════════════════════════════════════════════════

interface Props {
  modules: ModuleDef[];
  active: ModuleKey;
  /** Función que arma href para una tab dada · preserva params */
  buildHref: (module: ModuleKey) => string;
}

export function ModuleTabs({ modules, active, buildHref }: Props) {
  return (
    <nav className={styles.tabs} role="tablist">
      {modules.map((m) => {
        const isActive = m.key === active;
        const cls = `${styles.tab} ${isActive ? styles.active : ""} ${
          !m.enabled ? styles.disabled : ""
        }`;
        if (!m.enabled) {
          return (
            <span
              key={m.key}
              className={cls}
              role="tab"
              aria-disabled="true"
              title="Próximamente"
            >
              <span>{m.label}</span>
              <span className={styles.soon}>próximamente</span>
            </span>
          );
        }
        return (
          <Link
            key={m.key}
            href={buildHref(m.key)}
            className={cls}
            role="tab"
            aria-selected={isActive}
          >
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
