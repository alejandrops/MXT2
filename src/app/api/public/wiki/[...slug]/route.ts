import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// ═══════════════════════════════════════════════════════════════
//  /api/public/wiki/[...slug] · S6-WIKI
//  ─────────────────────────────────────────────────────────────
//  Endpoint público (no requiere auth) que sirve archivos MDX
//  desde docs/wiki/ como Markdown plano.
//
//  Convención de slugs:
//    URL  /api/public/wiki/conduccion/scorecard
//    slug = ["conduccion", "scorecard"]
//    file = docs/wiki/conduccion/scorecard.mdx
//
//  Por qué "public":
//    · No requiere session · cualquier visitante con el link
//      al app ya autenticado puede leer la doc
//    · La doc es shareable · útil para incrustar en emails de
//      onboarding o tickets de soporte
//
//  Anti path-traversal:
//    · Validamos que ningún segmento contenga ".." o "/"
//    · Validamos que el path resuelto esté dentro de docs/wiki
//
//  Cache:
//    · Header Cache-Control public · max-age 5 min · stale 1h
//      mientras el contenido sea estático (no DB-backed)
//
//  Response shape:
//    · 200 · { slug, content, exists: true }
//    · 404 · { slug, content: null, exists: false }
//    · 400 · { error: "Invalid slug" } · path traversal detectado
//    · 500 · { error: "Read failed" } · error de FS inesperado
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-static";

interface Params {
  slug: string[];
}

const SLUG_SEGMENT_RX = /^[a-z0-9_-]+$/;
const WIKI_ROOT = path.join(process.cwd(), "docs", "wiki");

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { slug } = await context.params;

  if (!Array.isArray(slug) || slug.length === 0) {
    return NextResponse.json(
      { error: "Invalid slug · empty path" },
      { status: 400 },
    );
  }

  // Validar cada segmento · solo a-z 0-9 _ -
  for (const seg of slug) {
    if (!SLUG_SEGMENT_RX.test(seg)) {
      return NextResponse.json(
        { error: `Invalid slug segment: "${seg}"` },
        { status: 400 },
      );
    }
  }

  const slugStr = slug.join("/");
  const candidate = path.join(WIKI_ROOT, ...slug) + ".mdx";
  const resolved = path.resolve(candidate);

  // Verificar que el path resuelto está dentro de WIKI_ROOT
  if (!resolved.startsWith(path.resolve(WIKI_ROOT) + path.sep)) {
    return NextResponse.json(
      { error: "Invalid slug · path escape" },
      { status: 400 },
    );
  }

  let content: string;
  try {
    content = await readFile(resolved, "utf8");
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      return NextResponse.json(
        {
          slug: slugStr,
          content: null,
          exists: false,
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Read failed", detail: e?.message ?? "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      slug: slugStr,
      content,
      exists: true,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
