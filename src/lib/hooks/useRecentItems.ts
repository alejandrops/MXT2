"use client";

import { useEffect, useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  useRecentItems · últimos 5 abiertos desde Cmd+K
//  ─────────────────────────────────────────────────────────────
//  Persiste en localStorage para que el usuario abra Cmd+K y
//  encuentre rápido los objetos que estuvo mirando.
//
//  Cada recent es un nodo navegable · href + meta para mostrarlo
//  en la lista. NO guarda info detallada (ej: KPIs) · solo lo
//  necesario para el menú.
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "maxtracker.cmdkRecents.v1";
const MAX_RECENTS = 5;

export interface RecentItem {
  /** Identificador único · evita duplicados */
  key: string;
  /** Texto principal (ej: "AB456" · "Juan Pérez" · "Análisis") */
  primary: string;
  /** Texto secundario opcional (ej: "Mercedes-Benz Atego 1726") */
  secondary?: string;
  /** Tipo · controla el badge */
  kind: "vehicle" | "driver" | "group" | "screen";
  /** URL al click */
  href: string;
  /** Timestamp último uso · para ordenar */
  ts: number;
}

export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  // Hidratar al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RecentItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed.sort((a, b) => b.ts - a.ts).slice(0, MAX_RECENTS));
        }
      }
    } catch {
      // ignorar · si el storage está corrupto, arrancamos vacío
    }
  }, []);

  const addRecent = useCallback((item: Omit<RecentItem, "ts">) => {
    setItems((prev) => {
      const next = [
        { ...item, ts: Date.now() },
        ...prev.filter((x) => x.key !== item.key),
      ].slice(0, MAX_RECENTS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage puede fallar en privado · ignorar
      }
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { items, addRecent, clearRecents };
}
