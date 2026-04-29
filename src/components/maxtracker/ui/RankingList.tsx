"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./RankingList.module.css";

// ═══════════════════════════════════════════════════════════════
//  RankingList · lista ordenada con barras horizontales
//  ─────────────────────────────────────────────────────────────
//  Reemplaza las 5 implementaciones distintas de ranking que hay
//  en la app (Dashboard, Análisis ranking view, imprimibles, etc).
//
//  Cada item:
//    · posición numérica (sin medallas · Tufte)
//    · nombre · link opcional al Libro del Objeto
//    · barra horizontal con width relativa al máximo
//    · valor numérico formateado a la derecha
//
//  Sin chartjunk · sin badges decorativos · sin sombras.
// ═══════════════════════════════════════════════════════════════

export interface RankingItem {
  /** Key único · usado para keyExtractor */
  id: string;
  /** Nombre principal · ej "AG017HZ" */
  name: string;
  /** Valor numérico · usa para sort y para bar width */
  value: number;
  /** Subtítulo opcional · ej "Camión Iveco · Grupo Sur" */
  subtitle?: string;
  /** URL para click · típicamente al Libro del Objeto · null = no link */
  href?: string;
  /** Render custom del valor · default = formatValue(value) */
  renderValue?: () => ReactNode;
}

interface Props {
  items: RankingItem[];
  /** Función para formatear el valor por default (si no hay renderValue) */
  formatValue: (v: number) => string;
  /** Limit · default no-limit · típico 5 o 10 */
  limit?: number;
  /** Ya vienen ordenados? · default false (RankingList ordena por value desc) */
  preSorted?: boolean;
  /** Mensaje vacío · default "Sin datos" */
  emptyMessage?: string;
  /** Mostrar barras · default true · si false es solo lista numerada */
  showBars?: boolean;
}

export function RankingList({
  items,
  formatValue,
  limit,
  preSorted = false,
  emptyMessage = "Sin datos",
  showBars = true,
}: Props) {
  const sorted = preSorted ? items : [...items].sort((a, b) => b.value - a.value);
  const displayed = limit ? sorted.slice(0, limit) : sorted;
  const max = displayed.length > 0 ? Math.max(0.001, displayed[0]!.value) : 1;

  if (displayed.length === 0) {
    return <div className={styles.empty}>{emptyMessage}</div>;
  }

  return (
    <ol className={styles.list}>
      {displayed.map((item, i) => {
        const widthPct = max > 0 ? Math.max(0, (item.value / max) * 100) : 0;
        const inner = (
          <>
            <span className={styles.idx}>{i + 1}</span>
            <div className={styles.body}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{item.name}</span>
                {item.subtitle && (
                  <span className={styles.subtitle}>· {item.subtitle}</span>
                )}
              </div>
              {showBars && (
                <span className={styles.bar}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${widthPct}%` }}
                  />
                </span>
              )}
            </div>
            <span className={styles.value}>
              {item.renderValue ? item.renderValue() : formatValue(item.value)}
            </span>
          </>
        );

        if (item.href) {
          return (
            <li key={item.id} className={styles.item}>
              <Link href={item.href} className={styles.link}>
                {inner}
              </Link>
            </li>
          );
        }
        return (
          <li key={item.id} className={styles.item}>
            <div className={styles.nonLink}>{inner}</div>
          </li>
        );
      })}
    </ol>
  );
}
