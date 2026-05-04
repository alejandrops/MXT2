// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccountScope } from "@/lib/queries/tenant-scope";
import { getUserNotifications } from "@/lib/queries/user-notifications";

// ═══════════════════════════════════════════════════════════════
//  GET /api/notifications · S3-L5
//  ─────────────────────────────────────────────────────────────
//  Endpoint que el dropdown del Bell del Topbar consulta cuando
//  el user lo abre. Devuelve agregado de:
//    · alarmas críticas activas
//    · boletines generados últimas 24h
//    · feedback propio que cambió de estado en la semana
//
//  No persiste read state · cada apertura del dropdown re-fetchea.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export async function GET() {
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const accountId = resolveAccountScope(session, "actividad", null);
    const notifications = await getUserNotifications({
      userId: session.user.id,
      accountId,
    });
    return NextResponse.json(notifications);
  } catch (err) {
    console.error("[notifications] failed:", err);
    return NextResponse.json(
      { items: [], unreadCount: 0 },
      { status: 200 },
    );
  }
}
