// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/email/send";
import { buildFeedbackNotificationEmail } from "@/lib/email/templates/feedback-notification";

// ═══════════════════════════════════════════════════════════════
//  POST /api/feedback · S1-L8 feedback-widget
//  ─────────────────────────────────────────────────────────────
//  Persiste el feedback enviado por el widget flotante.
//
//  Payload esperado (JSON):
//    {
//      message: string (required, 1-5000 chars),
//      category: "BUG" | "FEATURE" | "OTHER",
//      pageUrl: string (required),
//      userAgent: string (required),
//      viewport: string (optional, "WxH")
//    }
//
//  Auth · usa getSession · funciona en demo y supabase modes.
//  Si no hay sesión, responde 401.
//
//  Mail aviso · TODO Sprint 2:
//    Cuando integremos servicio de mail (Resend / SES / SendGrid),
//    disparar mail al owner del producto cuando entra feedback.
//    Por ahora · solo se persiste en DB · admin lo revisa manualmente.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["BUG", "FEATURE", "OTHER"] as const;

interface FeedbackPayload {
  message?: unknown;
  category?: unknown;
  pageUrl?: unknown;
  userAgent?: unknown;
  viewport?: unknown;
}

export async function POST(request: Request) {
  // ── 1. Auth ──────────────────────────────────────────────
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }

  // ── 2. Parse y validación del payload ─────────────────────
  let body: FeedbackPayload;
  try {
    body = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) {
    return NextResponse.json(
      { error: "Mensaje requerido" },
      { status: 400 },
    );
  }
  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Mensaje demasiado largo (máx. 5000 caracteres)" },
      { status: 400 },
    );
  }

  const categoryRaw =
    typeof body.category === "string" ? body.category.toUpperCase() : "OTHER";
  const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as (typeof VALID_CATEGORIES)[number])
    : "OTHER";

  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl : "";
  const userAgent = typeof body.userAgent === "string" ? body.userAgent : "";
  const viewport =
    typeof body.viewport === "string" && body.viewport.length > 0
      ? body.viewport
      : null;

  if (pageUrl.length === 0 || userAgent.length === 0) {
    return NextResponse.json(
      { error: "Contexto requerido (pageUrl, userAgent)" },
      { status: 400 },
    );
  }

  // ── 3. Persist ───────────────────────────────────────────
  try {
    const feedback = await db.feedback.create({
      data: {
        accountId: session.user.accountId,
        userId: session.user.id,
        category,
        message,
        pageUrl: pageUrl.slice(0, 1000),
        userAgent: userAgent.slice(0, 500),
        viewport,
        status: "NEW",
      },
      select: { id: true, createdAt: true },
    });

    // ── 4. S2-L2 · Mail aviso al PO (best-effort) ─────────
    // Fire-and-forget · no bloqueamos la respuesta del user esperando
    // que Resend conteste. Si falla, queda log pero el feedback ya
    // está persistido en DB · no se pierde.
    void notifyFeedbackByEmail({
      feedbackId: feedback.id,
      category,
      message,
      pageUrl,
      userAgent,
      viewport,
      user: {
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        profileLabel: session.profile.nameLabel,
      },
      createdAt: feedback.createdAt,
      origin: getOrigin(request),
    });

    console.log(
      `[feedback] new feedback id=${feedback.id} category=${category} userId=${session.user.id} url=${pageUrl}`,
    );

    return NextResponse.json({
      ok: true,
      id: feedback.id,
      createdAt: feedback.createdAt,
    });
  } catch (err) {
    console.error("[feedback] persist failed:", err);
    return NextResponse.json(
      { error: "No pudimos guardar el feedback. Probá de nuevo." },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  S2-L2 · helpers de notificación
// ═══════════════════════════════════════════════════════════════

interface NotifyArgs {
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
  };
  createdAt: Date;
  origin: string;
}

/**
 * Manda el mail de aviso al PO. Best-effort · no tira nunca, log
 * si algo va mal. El feedback ya está persistido cuando esto se
 * llama, así que un mail perdido no es pérdida total.
 */
async function notifyFeedbackByEmail(args: NotifyArgs): Promise<void> {
  const to = process.env.FEEDBACK_NOTIFY_TO;
  if (!to) {
    console.log("[feedback-mail] skipped · FEEDBACK_NOTIFY_TO not set");
    return;
  }

  const productUrl = `${args.origin}${args.pageUrl}`;

  const { subject, html, text } = buildFeedbackNotificationEmail({
    feedbackId: args.feedbackId,
    category: args.category,
    message: args.message,
    pageUrl: args.pageUrl,
    userAgent: args.userAgent,
    viewport: args.viewport,
    user: args.user,
    productUrl,
    createdAt: args.createdAt,
  });

  const result = await sendEmail({
    to,
    subject,
    html,
    text,
    replyTo: args.user.email,
  });

  if (result.ok) {
    console.log(
      `[feedback-mail] sent · feedbackId=${args.feedbackId} resendId=${result.id}`,
    );
  } else {
    console.warn(
      `[feedback-mail] failed · feedbackId=${args.feedbackId} reason=${result.reason}`,
    );
  }
}

/** Devuelve "https://host" del request actual · útil para CTAs en el mail */
function getOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
