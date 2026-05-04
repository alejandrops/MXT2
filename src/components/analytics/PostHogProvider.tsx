"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  capturePageView,
  identify,
  initPostHog,
  maybeStartSessionRecording,
} from "@/lib/analytics/posthog";

// ═══════════════════════════════════════════════════════════════
//  PostHogProvider · inicializa SDK + identify + pageviews
//  ─────────────────────────────────────────────────────────────
//  Componente client-side que:
//
//  1. Inicializa el SDK en el primer mount.
//  2. Identifica al user con sus traits (id, accountId, profile,
//     tier) · NUNCA email/nombres.
//  3. Captura un $pageview cada vez que cambia el pathname
//     (incluyendo searchParams para detectar nav SPA).
//
//  En modo demo o sin NEXT_PUBLIC_POSTHOG_KEY, el SDK queda en
//  no-op · este Provider sigue montándose pero no genera tráfico.
//  Eso permite agregar la key después sin tocar código.
//
//  Recibe `userTraits` desde el server layout · NO hace fetch
//  client-side de session (esa info ya estaba en el server).
// ═══════════════════════════════════════════════════════════════

interface UserTraits {
  userId: string;
  accountId: string | null;
  profileLabel: string;
  accountTier: string | null;
}

interface Props {
  authMode: "demo" | "supabase";
  user: UserTraits;
}

export function PostHogProvider({ authMode, user }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Init + identify · una sola vez por mount
  useEffect(() => {
    initPostHog({ authMode });
    identify(user.userId, {
      accountId: user.accountId,
      profileLabel: user.profileLabel,
      accountTier: user.accountTier,
    });
    // S1-L9 · session replay opt-in
    // Si NEXT_PUBLIC_ENABLE_SESSION_REPLAY === "1", activamos recording
    // siempre que el user no lo haya pausado previamente. El banner
    // SessionRecordingNotice avisa al user y le permite pausar.
    if (process.env.NEXT_PUBLIC_ENABLE_SESSION_REPLAY === "1") {
      maybeStartSessionRecording();
    }
    // El effect depende de cambios de identidad · re-identify si el user
    // cambió (caso del switcher SA → user-suplantado).
  }, [
    authMode,
    user.userId,
    user.accountId,
    user.profileLabel,
    user.accountTier,
  ]);

  // PageView en cada nav · incluye searchParams para SPA navs
  useEffect(() => {
    if (!pathname) return;
    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    capturePageView(url);
  }, [pathname, searchParams]);

  return null;
}
