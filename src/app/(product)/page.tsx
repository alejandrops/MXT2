import { redirect } from "next/navigation";

// ═══════════════════════════════════════════════════════════════
//  Home route
//  ─────────────────────────────────────────────────────────────
//  Pantalla por defecto al entrar al sistema · Mapa de Seguimiento
//  (vista operativa primaria · "qué está pasando ahora").
// ═══════════════════════════════════════════════════════════════

export default function HomePage() {
  redirect("/seguimiento/mapa");
}
