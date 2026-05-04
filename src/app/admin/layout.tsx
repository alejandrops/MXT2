// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
import { AdminSidebar } from "@/components/shell/AdminSidebar";
import { AdminTopbar } from "@/components/shell/AdminTopbar";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { getSession } from "@/lib/session";

// ═══════════════════════════════════════════════════════════════
//  Admin shell · backoffice surface
//  ─────────────────────────────────────────────────────────────
//  Used for /admin/* routes only. Visually distinct from the
//  product shell to make the context switch unambiguous.
//
//  L6 · PostHogProvider monta SDK + identify + pageviews · mismo
//  comportamiento que el product layout. En modo demo o sin key
//  configurada, queda en no-op.
// ═══════════════════════════════════════════════════════════════

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="app-root">
      <PostHogProvider
        authMode={session.authMode}
        user={{
          userId: session.user.id,
          accountId: session.user.accountId,
          profileLabel: session.profile.nameLabel,
          accountTier: session.account?.tier ?? null,
        }}
      />
      <div className="app-body">
        <AdminSidebar />
        <div className="app-main">
          <AdminTopbar />
          <main className="app-content app-content-admin">{children}</main>
        </div>
      </div>
    </div>
  );
}
