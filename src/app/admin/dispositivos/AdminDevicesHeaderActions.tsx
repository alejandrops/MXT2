"use client";

import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import styles from "./AdminDevicesHeaderActions.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminDevicesHeaderActions · botones del header (H5a-2)
//  ─────────────────────────────────────────────────────────────
//  Reemplaza el <NewDeviceButton /> previo, ahora tenés ambos:
//   · Importar CSV (drawer dark theme con bulk import)
//   · Nuevo dispositivo (form individual existente)
// ═══════════════════════════════════════════════════════════════

export function AdminDevicesHeaderActions() {
  const router = useRouter();

  function openImporter() {
    const url = new URL(window.location.href);
    url.searchParams.set("import", "1");
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  function openNew() {
    const url = new URL(window.location.href);
    url.searchParams.set("new", "1");
    url.searchParams.delete("import");
    url.searchParams.delete("edit");
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
      <button type="button" className={styles.newBtn} onClick={openNew}>
        <Plus size={14} />
        <span>Nuevo dispositivo</span>
      </button>
    </div>
  );
}
