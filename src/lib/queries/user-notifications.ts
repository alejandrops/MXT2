// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { db } from "@/lib/db";

// ═══════════════════════════════════════════════════════════════
//  getUserNotifications · S3-L5
//  ─────────────────────────────────────────────────────────────
//  Centro de notificaciones · agrega 3 fuentes:
//    1. Alarmas críticas activas (HIGH severity, OPEN)
//    2. Boletín cerrado · snapshot generado en últimas 24h
//    3. Feedback del usuario que cambió de estado (REVIEWED/CLOSED)
//
//  Scope · accountId del user · null = cross-tenant (SA/MA)
//
//  No persiste read/unread · cada vez que el user abre el dropdown
//  se construye desde fuentes vivas. Para Sprint 4+ agregaríamos
//  una tabla `Notification` con read flag.
// ═══════════════════════════════════════════════════════════════

export interface NotificationItem {
  id: string;
  kind: "alarm" | "boletin" | "feedback";
  title: string;
  detail: string;
  href: string;
  /** Date · momento del evento que generó la notif */
  at: Date;
  /** Severidad visual · alert para crítico, info para neutro */
  tone: "alert" | "warn" | "info";
}

export interface NotificationsBundle {
  items: NotificationItem[];
  unreadCount: number;
}

export async function getUserNotifications(args: {
  userId: string;
  accountId: string | null;
}): Promise<NotificationsBundle> {
  const items: NotificationItem[] = [];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // ── 1. Alarmas críticas activas del account ─────────────
  const criticalAlarms = await db.alarm.findMany({
    where: {
      ...(args.accountId ? { asset: { accountId: args.accountId } } : {}),
      status: "OPEN",
      severity: "HIGH",
    },
    select: {
      id: true,
      type: true,
      triggeredAt: true,
      asset: {
        select: { id: true, name: true, plate: true },
      },
    },
    orderBy: { triggeredAt: "desc" },
    take: 5,
  });

  for (const alarm of criticalAlarms) {
    items.push({
      id: `alarm-${alarm.id}`,
      kind: "alarm",
      title: humanizeAlarmType(alarm.type),
      detail: `${alarm.asset.name}${alarm.asset.plate ? ` · ${alarm.asset.plate}` : ""}`,
      href: `/objeto/vehiculo/${alarm.asset.id}?m=seguridad`,
      at: alarm.triggeredAt,
      tone: "alert",
    });
  }

  // ── 2. Boletines cerrados generados en últimas 24h ──────
  const recentBoletines = await db.boletinSnapshot.findMany({
    where: {
      generatedAt: { gte: dayAgo },
      ...(args.accountId ? { accountId: args.accountId } : {}),
    },
    select: {
      period: true,
      generatedAt: true,
      accountId: true,
    },
    orderBy: { generatedAt: "desc" },
    take: 3,
  });

  for (const snap of recentBoletines) {
    items.push({
      id: `boletin-${snap.period}-${snap.accountId ?? "all"}`,
      kind: "boletin",
      title: `Boletín ${snap.period} disponible`,
      detail: "Listo para consultar",
      href: `/direccion/boletin/${snap.period}`,
      at: snap.generatedAt,
      tone: "info",
    });
  }

  // ── 3. Feedback propio que cambió de estado en última semana ─
  const myFeedbacks = await db.feedback.findMany({
    where: {
      userId: args.userId,
      reviewedAt: { gte: weekAgo, not: null },
      status: { in: ["REVIEWED", "CLOSED"] },
    },
    select: {
      id: true,
      category: true,
      message: true,
      status: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: "desc" },
    take: 5,
  });

  for (const fb of myFeedbacks) {
    items.push({
      id: `feedback-${fb.id}`,
      kind: "feedback",
      title:
        fb.status === "CLOSED"
          ? "Tu feedback fue resuelto"
          : "Tu feedback está en revisión",
      detail: truncate(fb.message, 60),
      href: `/admin/feedback`, // si no es admin, redirige a /admin
      at: fb.reviewedAt!,
      tone: "info",
    });
  }

  // ── Sort por fecha desc · más reciente arriba ─────────
  items.sort((a, b) => b.at.getTime() - a.at.getTime());

  // Solo las primeras 10 notifs
  const limited = items.slice(0, 10);

  return {
    items: limited,
    unreadCount: limited.length,
  };
}

// ─── helpers ─────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function humanizeAlarmType(type: string): string {
  const map: Record<string, string> = {
    SOS: "Botón de pánico",
    PANIC: "Botón de pánico",
    OVERSPEED: "Exceso de velocidad",
    SPEEDING_CRITICAL: "Exceso de velocidad crítico",
    GEOFENCE_ENTER: "Entrada a geocerca",
    GEOFENCE_EXIT: "Salida de geocerca",
    LOW_BATTERY: "Batería baja",
    POWER_LOSS: "Pérdida de alimentación",
    HARSH_BRAKING: "Frenado brusco",
    HARSH_ACCELERATION: "Aceleración brusca",
    HARSH_DRIVING_PATTERN: "Conducción brusca recurrente",
    RECKLESS_BEHAVIOR: "Conducción imprudente",
    JAMMING: "Jamming detectado",
    DTC_TRIGGER: "Código de falla",
    NO_COMMUNICATION: "Sin comunicación",
    OFF_HOURS: "Fuera de horario",
  };
  return map[type] ?? type;
}
