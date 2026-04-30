"use client";

import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import styles from "./AdminVehiclesHeaderActions.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminVehiclesHeaderActions · H7c-2
//  ─────────────────────────────────────────────────────────────
//  Por ahora solo botón "Importar CSV" que abre el drawer
//  importer (?import=1). El bulk delete vive en el BulkContainer
//  porque depende de selección.
// ═══════════════════════════════════════════════════════════════

export function AdminVehiclesHeaderActions() {
  const router = useRouter();

  function openImporter() {
    const url = new URL(window.location.href);
    url.searchParams.set("import", "1");
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <div className={styles.headerActions}>
      <button
        type="button"
        className={styles.importBtn}
        onClick={openImporter}
      >
        <Upload size={13} />
        <span>Importar CSV</span>
      </button>
    </div>
  );
}
