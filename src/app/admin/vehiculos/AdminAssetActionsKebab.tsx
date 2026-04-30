"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import styles from "./AdminAssetActionsKebab.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminAssetActionsKebab · H7c-1
//  ─────────────────────────────────────────────────────────────
//  Por ahora simple · solo abre el drawer técnico (read-only).
//  En H7c-2 se sumará "Eliminar" cuando agreguemos bulk delete.
// ═══════════════════════════════════════════════════════════════

interface Props {
  assetId: string;
  assetName: string;
}

export function AdminAssetActionsKebab({ assetId }: Props) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.searchParams.set("edit", assetId);
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={handleClick}
      aria-label="Ver detalle técnico"
      title="Ver detalle técnico"
    >
      <ChevronRight size={14} />
    </button>
  );
}
