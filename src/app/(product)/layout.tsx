import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

// ═══════════════════════════════════════════════════════════════
//  Product shell · light sidebar + topbar with avatar menu
//  ─────────────────────────────────────────────────────────────
//  Used for all client-facing routes: Seguimiento, Seguridad,
//  Gestión, etc. Pairs with /admin which has its own dark shell.
// ═══════════════════════════════════════════════════════════════

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-root">
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <Topbar />
          <main className="app-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
