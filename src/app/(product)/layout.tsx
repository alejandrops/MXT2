// @ts-nocheck · pre-existing TS errors
import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { GlobalFilterBar } from "@/components/maxtracker/ui";
import { CommandPalette } from "@/components/maxtracker/cmdk/CommandPalette";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { NavTracker } from "@/components/analytics/NavTracker";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getFleetOpenAlarmsCount } from "@/lib/queries/fleet-metrics";

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
//
//  L2B-4 · Resuelve openAlarmsCount server-side y lo inyecta al
//  Sidebar. Reemplaza el `badge: 7` hardcoded del demo · ahora el
//  número refleja la realidad de la DB y el scope multi-tenant
//  del user. Scope "seguridad" porque es el módulo dueño del nav-item.
//
//  L6 · PostHogProvider monta el SDK y emite identify + pageviews.
//  En modo demo o sin NEXT_PUBLIC_POSTHOG_KEY, queda en no-op.
//  PII (email/nombres) NUNCA se envía · solo IDs.
// ═══════════════════════════════════════════════════════════════

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const scopedAccountId = resolveAccountScope(session, "seguridad", null);
  const openAlarmsCount = await getFleetOpenAlarmsCount(
    { accountId: scopedAccountId },
    { domain: "SEGURIDAD" },
  );

  return (
    <div className="app-root">
      <ThemeProvider pref={session.user.theme as "LIGHT" | "DARK" | "AUTO"} />
      <PostHogProvider
        authMode={session.authMode}
        user={{
          userId: session.user.id,
          accountId: session.user.accountId,
          profileLabel: session.profile.nameLabel,
          accountTier: session.account?.tier ?? null,
        }}
      />
      <Suspense fallback={null}>
        <NavTracker />
      </Suspense>
      <div className="app-body">
        <Sidebar openAlarmsCount={openAlarmsCount} />
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
