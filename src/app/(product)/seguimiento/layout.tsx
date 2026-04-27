// ═══════════════════════════════════════════════════════════════
//  Seguimiento module layout
//  ─────────────────────────────────────────────────────────────
//  Module containing: Mapa, Viajes, Historial.
//  Pass-through layout. The Sidebar in the root layout detects
//  the active module from pathname.
// ═══════════════════════════════════════════════════════════════

export default function SeguimientoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
