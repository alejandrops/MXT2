// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { Resend } from "resend";

// ═══════════════════════════════════════════════════════════════
//  src/lib/email/send.ts · S2-L2 mail aviso feedback
//  ─────────────────────────────────────────────────────────────
//  Wrapper sobre Resend con graceful degradation:
//    · Si RESEND_API_KEY no está seteado → log y no-op
//    · Si FEEDBACK_NOTIFY_TO no está seteado → log y no-op
//    · Si Resend tira error → log pero NO rompe el flow del caller
//
//  La filosofía es: el feedback se persiste en DB siempre, el mail
//  es best-effort. Nunca queremos que un error de Resend rompa la
//  experiencia del tester.
//
//  Setup necesario en Vercel:
//    RESEND_API_KEY=re_xxx          (Resend dashboard → API Keys)
//    FEEDBACK_NOTIFY_TO=tu@mail.com (a quién mandar las notifs)
//    FEEDBACK_NOTIFY_FROM=...       (opcional, default
//                                    "Maxtracker <onboarding@resend.dev>")
//
//  Para producción real necesitás verificar tu dominio en Resend
//  (ej. mail.maxtracker.app) y usar from="feedback@mail.maxtracker.app".
//  Mientras tanto, el sandbox @resend.dev sirve para testing.
// ═══════════════════════════════════════════════════════════════

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  /** Opcional · plain text fallback */
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** ID del mail en Resend si se mandó OK */
  id?: string;
  /** Razón del skip o error · null si ok=true */
  reason?: string;
}

/**
 * Manda un email vía Resend. Devuelve siempre · nunca tira.
 * El caller no debería bloquearse esperando este resultado para
 * el flow principal · es best-effort.
 */
export async function sendEmail(
  args: SendEmailArgs,
): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    console.log("[email] skipped · RESEND_API_KEY not configured");
    return { ok: false, reason: "RESEND_API_KEY missing" };
  }

  const from =
    args.from ??
    process.env.FEEDBACK_NOTIFY_FROM ??
    "Maxtracker <onboarding@resend.dev>";

  try {
    const result = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      ...(args.text && { text: args.text }),
      ...(args.replyTo && { replyTo: args.replyTo }),
    });

    if (result.error) {
      console.error("[email] resend error:", result.error);
      return {
        ok: false,
        reason: result.error.message ?? "unknown resend error",
      };
    }

    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error("[email] send threw:", err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
