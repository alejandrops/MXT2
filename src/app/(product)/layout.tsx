import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { GlobalFilterBar } from "@/components/maxtracker/ui";
import { CommandPalette } from "@/components/maxtracker/cmdk/CommandPalette";
import { getSession, listDemoIdentities } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Product shell · light sidebar + topbar with avatar menu
//  ─────────────────────────────────────────────────────────────
//  Used for all client-facing routes: Seguimiento, Seguridad,
//  Gestión, etc. Pairs with /admin which has its own dark shell.
//
//  Lote F1 · ahora resuelve la sesión y la pasa al Topbar para
//  que el avatar muestre el usuario real (no más "AS" hardcoded).
//  También pasa la lista de identidades demo para el switcher.
// ═══════════════════════════════════════════════════════════════

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, demoIdentities] = await Promise.all([
    getSession(),
    listDemoIdentities(),
  ]);

  return (
    <div className="app-root">
      <div className="app-body">
        <Sidebar session={session} />
        <div className="app-main">
          <Topbar
            session={session}
            demoIdentities={demoIdentities}
          />
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
