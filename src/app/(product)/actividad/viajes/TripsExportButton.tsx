"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { exportTripsXlsx } from "@/lib/excel/client";
import type { TripsParams } from "@/lib/url-trips";
import styles from "./TripsExportButton.module.css";

// ═══════════════════════════════════════════════════════════════
//  TripsExportButton · L10
//  ─────────────────────────────────────────────────────────────
//  Botón "Exportar Excel" que dispara fetch a /api/export/xlsx
//  y triggea download en el browser.
//
//  Estados:
//   · idle    · botón normal
//   · loading · spinner + "Generando..."
//   · error   · mensaje breve · vuelve a idle al clickear
// ═══════════════════════════════════════════════════════════════

interface Props {
  params: TripsParams;
}

export function TripsExportButton({ params }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      await exportTripsXlsx({
        fromDate: params.fromDate,
        toDate: params.toDate,
        assetIds: params.assetIds,
        groupIds: params.groupIds,
        personIds: params.personIds,
      });
      setStatus("idle");
    } catch (err) {
      console.error("[TripsExportButton]", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={handleClick}
      disabled={status === "loading"}
      title="Descargar viajes en Excel (.xlsx)"
    >
      <FileSpreadsheet size={13} />
      <span>
        {status === "loading"
          ? "Generando…"
          : status === "error"
            ? "Error · reintentar"
            : "Exportar Excel"}
      </span>
    </button>
  );
}
