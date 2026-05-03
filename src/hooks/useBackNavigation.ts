"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  useBackNavigation · L4
//  ─────────────────────────────────────────────────────────────
//  Mantiene un stack de URLs visitadas en sessionStorage para
//  que los botones "Volver" lleven al lugar de origen, no a la
//  vista general.
//
//  Caso real (feedback Jere):
//   · Estás en /seguimiento/historial?asset=X
//   · Click en una alarma del asset → /alarmas/abc
//   · Click "Volver" debe llevar a /seguimiento/historial?asset=X
//     (de donde venías), NO a /alarmas (vista general).
//
//  Diseño:
//   · El stack vive en sessionStorage (clave "mxt-nav-stack")
//   · En cada nav, el pathname+search se pushea al stack
//   · `goBack()` saca el último entry y navega
//   · Cap de 10 entries · evita memoria infinita en sesiones largas
//   · Fallback configurable · si el stack está vacío, va a una URL
//     definida por la página (ej: /seguimiento/historial)
//
//  Trade-off: sessionStorage NO sobrevive a refresh de tab. Es OK
//  para el caso de uso (back-button es UX in-session). Si algún
//  día queremos persistencia cross-session, migrar a localStorage.
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "mxt-nav-stack";
const MAX_STACK = 10;

interface StackEntry {
  url: string;
  label?: string;
}

function readStack(): StackEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStack(stack: StackEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Cap defensivo · descartar las entries más viejas
    const capped = stack.slice(-MAX_STACK);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // sessionStorage puede fallar si está deshabilitado · ignoramos
  }
}

/**
 * Pushea la URL actual al stack. Llamar desde un page-level
 * effect en cada pantalla que querés que sea "destino de back".
 *
 * Ejemplo en una page:
 *   useTrackPageInBackStack({ label: "Vehículo" });
 */
export function useTrackPageInBackStack(opts?: { label?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    const stack = readStack();
    const last = stack[stack.length - 1];
    // Idempotente · si la URL es la misma que el top, no duplicar
    if (last?.url === url) return;
    stack.push({ url, label: opts?.label });
    writeStack(stack);
  }, [pathname, searchParams, opts?.label]);
}

/**
 * Devuelve el handler `goBack` que saca el penúltimo entry del
 * stack y navega ahí. Si el stack tiene 0 o 1 entries (estamos
 * en la primera página de la sesión), navega a `fallbackUrl`.
 *
 * Si la pantalla actual no fue trackeada (stack último es otro
 * pathname), igualmente vamos al penúltimo · es lo correcto en
 * casos donde el track se hizo antes y ahora estamos en una
 * página derivada.
 */
export function useBackNavigation(fallbackUrl: string) {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = useCallback(() => {
    const stack = readStack();
    // Buscar el entry más reciente que NO sea el pathname actual
    let target: StackEntry | undefined;
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (!entry) continue;
      const entryPath = entry.url.split("?")[0];
      if (entryPath !== pathname) {
        target = entry;
        // Limpiar las entries posteriores · evita ir adelante con back
        writeStack(stack.slice(0, i + 1));
        break;
      }
    }
    if (target) {
      router.push(target.url);
    } else {
      router.push(fallbackUrl);
    }
  }, [router, pathname, fallbackUrl]);

  return goBack;
}

/**
 * Lee el label custom del top del stack (la página de origen
 * pasó un label al trackear). Útil para mostrar "Volver a
 * Vehículos" vs "Volver al Mapa" según donde venías.
 *
 * Si no hay label en el stack, devuelve `defaultLabel`.
 */
export function useBackLabel(defaultLabel: string): string {
  const stack = readStack();
  const pathname = usePathname();

  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i];
    if (!entry) continue;
    const entryPath = entry.url.split("?")[0];
    if (entryPath !== pathname && entry.label) {
      return entry.label;
    }
  }
  return defaultLabel;
}
