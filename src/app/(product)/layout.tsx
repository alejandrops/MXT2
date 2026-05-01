import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { GlobalFilterBar } from "@/components/maxtracker/ui";
import { CommandPalette } from "@/components/maxtracker/cmdk/CommandPalette";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Product shell · light sidebar + topbar with avatar menu
//  ─────────────────────────────────────────────────────────────
//  Used for all client-facing routes: Seguimiento, Seguridad,
//  Gestión, etc. Pairs with /admin which has its own dark shell.
//
//  Refactor F2.E · monta <CommandPalette /> · Cmd+K abre desde
//  cualquier pantalla · search global de objetos y pantallas.
//
//  S2 · Carga session en el server, la pasa al Topbar para que
//  muestre el user real y permita logout. ThemeProvider sincroniza
//  preferencia user con el DOM (data-theme="dark|light").
// ═══════════════════════════════════════════════════════════════

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="app-root">
      <ThemeProvider pref={session.user.theme as "LIGHT" | "DARK" | "AUTO"} />
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <Topbar
            user={{
              firstName: session.user.firstName,
              lastName: session.user.lastName,
              email: session.user.email,
              profileLabel: session.profile.nameLabel,
            }}
            isSuperAdmin={
              session.profile.systemKey === "SUPER_ADMIN" ||
              session.profile.systemKey === "MAXTRACKER_ADMIN"
            }
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
