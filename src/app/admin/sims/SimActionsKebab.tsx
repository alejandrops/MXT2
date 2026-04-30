"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { deleteSim } from "./actions";
import styles from "./SimActionsKebab.module.css";

interface Props {
  simId: string;
  iccid: string;
  status: "STOCK" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
}

export function SimActionsKebab({ simId, iccid, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open && !confirmingDelete && !errorMsg) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
        setErrorMsg(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmingDelete(false);
        setErrorMsg(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, confirmingDelete, errorMsg]);

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    router.push(`/admin/sims?edit=${simId}`, { scroll: false });
  }

  function handleConfirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteSim(simId);
      if (result.ok) {
        setConfirmingDelete(false);
        router.refresh();
      } else {
        setConfirmingDelete(false);
        setErrorMsg(result.message ?? "Error al eliminar");
      }
    });
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingDelete(false);
    setErrorMsg(null);
  }

  const deleteDisabled = status === "ACTIVE";

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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (deleteDisabled) {
                setOpen(false);
                setErrorMsg(
                  `No se puede eliminar una SIM activa. Cambialá a "Suspendida" o "Cancelada" primero.`,
                );
                return;
              }
              setOpen(false);
              setConfirmingDelete(true);
            }}
            role="menuitem"
            disabled={deleteDisabled}
            title={
              deleteDisabled
                ? "Para eliminar, primero cambiá el estado"
                : undefined
            }
          >
            <Trash2 size={13} />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {confirmingDelete && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>
            ¿Eliminar la SIM <strong className={styles.mono}>{iccid}</strong>?
          </div>
          <div className={styles.confirmHint}>
            Esta acción es irreversible. Si tenés que mantener el historial,
            mejor marcalá como cancelada en lugar de eliminarla.
          </div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${styles.confirmBtn} ${styles.confirmBtnDanger}`}
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className={styles.errorPopover} role="alertdialog">
          <div className={styles.errorMsg}>{errorMsg}</div>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
