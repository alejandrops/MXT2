// @ts-nocheck · pre-existing patterns (Prisma types stale)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

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

    // TODO Sprint 2 · disparar mail aviso al owner
    // Cuando integremos Resend/SES/SendGrid:
    //   await sendOwnerNotification({
    //     feedbackId: feedback.id,
    //     userId: session.user.id,
    //     userEmail: session.user.email,
    //     category,
    //     message,
    //     pageUrl,
    //   });

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
