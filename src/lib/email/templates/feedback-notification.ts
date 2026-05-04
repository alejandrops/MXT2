// ═══════════════════════════════════════════════════════════════
//  src/lib/email/templates/feedback-notification.ts
//  ─────────────────────────────────────────────────────────────
//  Template del email que llega al PO cuando un tester envía
//  feedback. HTML simple · inline styles · compatible con Gmail,
//  Outlook, Apple Mail.
// ═══════════════════════════════════════════════════════════════

interface FeedbackNotifyArgs {
  feedbackId: string;
  category: "BUG" | "FEATURE" | "OTHER";
  message: string;
  pageUrl: string;
  userAgent: string;
  viewport: string | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    profileLabel: string;
  } | null;
  productUrl: string;
  createdAt: Date;
}

const CATEGORY_LABEL: Record<string, string> = {
  BUG: "🐛 Bug",
  FEATURE: "💡 Idea",
  OTHER: "💬 Otro",
};

const CATEGORY_COLOR: Record<string, string> = {
  BUG: "#dc2626",
  FEATURE: "#0891b2",
  OTHER: "#475569",
};

export function buildFeedbackNotificationEmail(args: FeedbackNotifyArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const categoryLabel = CATEGORY_LABEL[args.category] ?? args.category;
  const categoryColor = CATEGORY_COLOR[args.category] ?? "#475569";

  const userBlock = args.user
    ? `${escapeHtml(args.user.firstName)} ${escapeHtml(args.user.lastName)} · ${escapeHtml(args.user.profileLabel)} · ${escapeHtml(args.user.email)}`
    : "Usuario anónimo (sin sesión)";

  const subject = `[Maxtracker · ${args.category}] ${truncate(args.message, 60)}`;

  // Detectar dispositivo del UA · simple
  const device = detectDevice(args.userAgent);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">

          <!-- Header con categoría -->
          <tr>
            <td style="padding:18px 24px;background:${categoryColor};color:#ffffff;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;opacity:0.85;">
                Nuevo feedback · Maxtracker
              </div>
              <div style="font-size:18px;font-weight:600;margin-top:4px;">
                ${categoryLabel}
              </div>
            </td>
          </tr>

          <!-- Mensaje -->
          <tr>
            <td style="padding:24px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:8px;">
                Mensaje
              </div>
              <div style="font-size:15px;line-height:1.55;color:#0f172a;white-space:pre-wrap;">${escapeHtml(args.message)}</div>
            </td>
          </tr>

          <!-- Metadata -->
          <tr>
            <td style="padding:0 24px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${row("Usuario", userBlock)}
                      ${row("Página", `<code style="font-family:Menlo,Monaco,monospace;font-size:12px;color:#0f172a;background:#e2e8f0;padding:2px 6px;border-radius:3px;">${escapeHtml(args.pageUrl)}</code>`)}
                      ${row("Dispositivo", `${escapeHtml(device)}${args.viewport ? ` · ${escapeHtml(args.viewport)}` : ""}`)}
                      ${row("Fecha", formatDateAR(args.createdAt))}
                      ${row("ID", `<code style="font-family:Menlo,Monaco,monospace;font-size:11px;color:#475569;">${escapeHtml(args.feedbackId)}</code>`)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 24px 24px;">
              <a href="${escapeHtml(args.productUrl)}" style="display:inline-block;padding:9px 16px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:5px;font-size:13px;font-weight:500;">
                Ir a Maxtracker →
              </a>
              <span style="color:#94a3b8;font-size:11px;margin-left:8px;">
                (admin UI de feedback · próximo lote)
              </span>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <div style="font-size:10.5px;color:#94a3b8;line-height:1.5;">
                Recibís este mail porque sos el contacto de feedback configurado.
                Para cambiar el destino · editá <code>FEEDBACK_NOTIFY_TO</code> en las env vars de Vercel.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain text fallback · útil para clients que no renderizan HTML
  const text = [
    `Nuevo feedback · Maxtracker · ${categoryLabel}`,
    "",
    "─────────────────────────────────────────",
    "Mensaje:",
    args.message,
    "─────────────────────────────────────────",
    "",
    `Usuario · ${args.user ? `${args.user.firstName} ${args.user.lastName} · ${args.user.email}` : "Anónimo"}`,
    `Página  · ${args.pageUrl}`,
    `Equipo  · ${device}${args.viewport ? ` · ${args.viewport}` : ""}`,
    `Fecha   · ${formatDateAR(args.createdAt)}`,
    `ID      · ${args.feedbackId}`,
    "",
    `Maxtracker → ${args.productUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// ─── helpers ─────────────────────────────────────────────────

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:4px 0;font-size:11.5px;color:#94a3b8;width:90px;vertical-align:top;text-transform:uppercase;letter-spacing:0.4px;font-weight:500;">${label}</td>
      <td style="padding:4px 0;font-size:13px;color:#0f172a;line-height:1.5;">${value}</td>
    </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function detectDevice(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function formatDateAR(d: Date): string {
  // YYYY-MM-DD HH:mm en hora AR (UTC-3)
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const yyyy = ar.getUTCFullYear();
  const mm = String(ar.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ar.getUTCDate()).padStart(2, "0");
  const hh = String(ar.getUTCHours()).padStart(2, "0");
  const mi = String(ar.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} AR`;
}
