"use client";

import { useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
//  ThemeProvider · sincroniza preferencia user con <html>
//  ─────────────────────────────────────────────────────────────
//  Lee el theme del user (LIGHT / DARK / AUTO) y aplica
//  data-theme="light|dark" al <html>. Para AUTO escucha al OS.
//
//  El primer paint usa la cookie `mxt-theme` (vía SSR · ver
//  ThemeBoot inline en el layout) · evita "flash" de tema
//  incorrecto al cargar.
//
//  Componente client · debe envolver al layout. No renderiza
//  nada visible.
// ═══════════════════════════════════════════════════════════════

export type ThemePref = "LIGHT" | "DARK" | "AUTO";

interface Props {
  /** Preferencia del user (de la DB) */
  pref: ThemePref;
}

/** Resuelve el modo efectivo a aplicar (light o dark) según preferencia + OS */
export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "LIGHT") return "light";
  if (pref === "DARK") return "dark";
  // AUTO · seguir al OS
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

export function ThemeProvider({ pref }: Props) {
  useEffect(() => {
    function apply() {
      const resolved = resolveTheme(pref);
      document.documentElement.dataset.theme = resolved;

      // Persistir cookie · para SSR del próximo request (evita flash)
      // 1 año de duración
      document.cookie = `mxt-theme=${resolved}; max-age=31536000; path=/; samesite=lax`;
    }

    apply();

    // Si el user eligió AUTO, escuchar cambios del OS
    if (pref === "AUTO" && typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply();
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }

    return undefined;
  }, [pref]);

  return null;
}
