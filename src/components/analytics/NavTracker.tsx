"use client";

import { useTrackPageInBackStack } from "@/hooks/useBackNavigation";

// ═══════════════════════════════════════════════════════════════
//  NavTracker · L4
//  ─────────────────────────────────────────────────────────────
//  Component-only-effect que llama useTrackPageInBackStack() en
//  cada nav. Se monta una vez en el layout (Server) para que
//  TODAS las pantallas pusheen al stack sin tener que importar
//  el hook individualmente.
//
//  No renderiza nada · es un punto de entrada para hooks que
//  debe vivir en Client tree.
// ═══════════════════════════════════════════════════════════════

export function NavTracker() {
  useTrackPageInBackStack();
  return null;
}
