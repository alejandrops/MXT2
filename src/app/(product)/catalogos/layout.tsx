// ═══════════════════════════════════════════════════════════════
//  Catálogos module layout
//  ─────────────────────────────────────────────────────────────
//  Module containing: Vehículos, Conductores, Grupos.
//  Listas paginadas que linkean al Libro del Objeto · sin
//  detalle propio. Pass-through layout.
// ═══════════════════════════════════════════════════════════════

export default function CatalogosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
