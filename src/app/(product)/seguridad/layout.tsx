// ═══════════════════════════════════════════════════════════════
//  Seguridad module layout
//  ─────────────────────────────────────────────────────────────
//  Pass-through for Lote 1.1. In Lote 1.2 we will mark
//  the "Seguridad" module as active in the Sidebar via a
//  shared context. For now the Sidebar is dumb and highlights
//  Seguridad statically.
// ═══════════════════════════════════════════════════════════════

export default function SeguridadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
