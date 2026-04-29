// ═══════════════════════════════════════════════════════════════
//  Print shell · sin sidebar/topbar · optimizado para impresión
//  ─────────────────────────────────────────────────────────────
//  Las rutas en este grupo se ven en pantalla con un wrap simple
//  pero al imprimir aplican CSS @page para A4 sin elementos del
//  app shell.
// ═══════════════════════════════════════════════════════════════

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="print-root">{children}</div>;
}
