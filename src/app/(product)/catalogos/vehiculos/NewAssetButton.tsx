"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  Botón "+ Nuevo vehículo" del header
//  ─────────────────────────────────────────────────────────────
//  Navega a /catalogos/vehiculos?new=1 (preservando otros query
//  params como filtros). Al volver de cerrar el drawer, esos
//  filtros siguen activos.
// ═══════════════════════════════════════════════════════════════

export function NewAssetButton() {
  const router = useRouter();

  function handleClick() {
    const url = new URL(window.location.href);
    url.searchParams.set("new", "1");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <button type="button" className={styles.newBtn} onClick={handleClick}>
      <Plus size={14} />
      <span>Nuevo vehículo</span>
    </button>
  );
}
