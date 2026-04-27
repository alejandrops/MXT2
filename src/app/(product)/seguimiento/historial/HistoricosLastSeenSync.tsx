"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { buildHistoricosHref } from "@/lib/url-historicos";

// ═══════════════════════════════════════════════════════════════
//  HistoricosLastSeenSync
//  ─────────────────────────────────────────────────────────────
//  Two responsibilities:
//
//  1. ON FIRST MOUNT (URL had no assetId)
//     If localStorage has a "last seen" asset that's still in the
//     fleet, redirect there. Server-side already picked the first
//     asset alphabetically; this just upgrades to the user's most
//     recent choice.
//
//  2. AFTER THAT (every render)
//     Save the current selection as the new "last seen" so next
//     time the user opens Históricos we land on the same asset.
//     CRITICAL: never redirect again after the first render —
//     that would fight against the user's manual selection from
//     the combobox.
//
//  Renders nothing.
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "maxtracker:historicos:lastSeenAssetId";

interface HistoricosLastSeenSyncProps {
  urlHadAssetId: boolean;
  currentAssetId: string | null;
  currentDate: string;
  availableAssetIds: string[];
}

export function HistoricosLastSeenSync({
  urlHadAssetId,
  currentAssetId,
  availableAssetIds,
}: HistoricosLastSeenSyncProps) {
  const router = useRouter();

  // Tracks whether we've already done the initial mount handling.
  // Once true, we never redirect again — only persist.
  const didInitRef = useRef(false);

  // ── First mount: maybe redirect to the user's last-seen asset ──
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (typeof window === "undefined") return;

    if (!urlHadAssetId) {
      let lastSeen: string | null = null;
      try {
        lastSeen = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // localStorage may be unavailable (private mode etc.)
        return;
      }
      if (
        lastSeen &&
        lastSeen !== currentAssetId &&
        availableAssetIds.includes(lastSeen)
      ) {
        router.replace(
          buildHistoricosHref(
            { assetId: null, date: null, fromTime: null, toTime: null },
            { assetId: lastSeen },
          ),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist current selection on every render where it's set ──
  // Never redirects from here. This effect's only job is to
  // remember the user's latest choice for next session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentAssetId) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, currentAssetId);
    } catch {
      // ignore (e.g. quota exceeded, private mode)
    }
  }, [currentAssetId]);

  return null;
}
