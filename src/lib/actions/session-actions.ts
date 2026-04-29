"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
//  Server actions de sesión
//  ─────────────────────────────────────────────────────────────
//  switchIdentity · setea la cookie demo y revalida todo el
//  layout. El componente que la llama tiene que hacer
//  router.refresh() después para que la UI se actualice.
//
//  En producción real (con Auth0) este archivo se elimina · el
//  switcher de identidad es solo para demo.
// ═══════════════════════════════════════════════════════════════

const COOKIE_NAME = "mxt-demo-user-id";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 días

export async function switchIdentity(userId: string) {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId requerido");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    path: "/",
    maxAge: MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });

  // Revalidar todo el árbol porque sesión afecta a sidebar,
  // topbar, queries, permisos, etc.
  revalidatePath("/", "layout");
}
