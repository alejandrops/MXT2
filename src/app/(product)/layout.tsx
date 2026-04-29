import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { GlobalFilterBar } from "@/components/maxtracker/ui";
import { CommandPalette } from "@/components/maxtracker/cmdk/CommandPalette";

// ═══════════════════════════════════════════════════════════════
//  Product shell · light sidebar + topbar with avatar menu
//  ─────────────────────────────────────────────────────────────
//  Used for all client-facing routes: Seguimiento, Seguridad,
//  Gestión, etc. Pairs with /admin which has its own dark shell.
//
//  Refactor F2.E · monta <CommandPalette /> · Cmd+K abre desde
//  cualquier pantalla · search global de objetos y pantallas.
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
          <Suspense fallback={null}>
            <GlobalFilterBar />
          </Suspense>
          <main className="app-content">{children}</main>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
