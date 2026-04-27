import { AdminSidebar } from "@/components/shell/AdminSidebar";
import { AdminTopbar } from "@/components/shell/AdminTopbar";

// ═══════════════════════════════════════════════════════════════
//  Admin shell · backoffice surface
//  ─────────────────────────────────────────────────────────────
//  Used for /admin/* routes only. Visually distinct from the
//  product shell to make the context switch unambiguous.
// ═══════════════════════════════════════════════════════════════

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-root">
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
