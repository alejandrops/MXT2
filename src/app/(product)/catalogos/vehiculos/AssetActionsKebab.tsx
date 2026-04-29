"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { softDeleteAsset } from "./actions";
import styles from "./AssetActionsKebab.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetActionsKebab · botón "⋮" + menu Editar/Eliminar
//  ─────────────────────────────────────────────────────────────
//  Por fila. Click "Editar" → router.push con ?edit=<id> · que
//  hace que la página re-renderice con el drawer abierto.
//  Click "Eliminar" pide confirmación y dispara softDeleteAsset.
//
//  El stopPropagation es crítico porque la fila entera tiene
//  Links a /objeto/vehiculo/{id} (Libro). Sin stopPropagation
//  el click del kebab navegaría al Libro.
// ═══════════════════════════════════════════════════════════════

interface Props {
  assetId: string;
  assetName: string;
}

export function AssetActionsKebab({ assetId, assetName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Cerrar con click fuera / Escape
  useEffect(() => {
    if (!open && !confirmingDelete) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, confirmingDelete]);

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    router.push(`/catalogos/vehiculos?edit=${assetId}`, { scroll: false });
  }

  function handleDeleteRequest(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setConfirmingDelete(true);
  }

  function handleConfirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await softDeleteAsset(assetId);
      setConfirmingDelete(false);
      router.refresh();
    });
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingDelete(false);
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={styles.btn}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Acciones"
        aria-expanded={open}
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.menuItem}
            onClick={handleEdit}
            role="menuitem"
          >
            <Pencil size={13} />
            <span>Editar</span>
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={handleDeleteRequest}
            role="menuitem"
          >
            <Trash2 size={13} />
            <span>Dar de baja</span>
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>
            ¿Dar de baja a <strong>{assetName}</strong>?
          </div>
          <div className={styles.confirmHint}>
            El vehículo se marcará en mantenimiento y dejará de aparecer en
            las vistas operativas.
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancelDelete}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {isPending ? "Procesando…" : "Dar de baja"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
