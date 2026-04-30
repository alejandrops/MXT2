"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { deleteGroup } from "./actions";
import styles from "./GroupActionsKebab.module.css";

// ═══════════════════════════════════════════════════════════════
//  GroupActionsKebab · botón ⋮ + menu Editar/Eliminar
//  ─────────────────────────────────────────────────────────────
//  Eliminar es HARD delete · si tiene subgrupos hijos o vehículos
//  asignados, la action falla con mensaje explicativo en popover.
// ═══════════════════════════════════════════════════════════════

interface Props {
  groupId: string;
  groupName: string;
  /** H7b · si false oculta "Editar" del menú */
  canEdit: boolean;
  /** H7b · si false oculta "Eliminar" del menú */
  canDelete: boolean;
}

export function GroupActionsKebab({
  groupId,
  groupName,
  canEdit,
  canDelete,
}: Props) {
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
    router.push(`/catalogos/grupos?edit=${groupId}`, { scroll: false });
  }

  function handleDeleteRequest(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setConfirmingDelete(true);
    setErrorMsg(null);
  }

  function handleConfirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteGroup(groupId);
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

  // Si no tiene ningún permiso, no mostrar el kebab
  if (!canEdit && !canDelete) {
    return null;
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
          {canEdit && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleEdit}
              role="menuitem"
            >
              <Pencil size={13} />
              <span>Editar</span>
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={handleDeleteRequest}
              role="menuitem"
            >
              <Trash2 size={13} />
              <span>Eliminar</span>
            </button>
          )}
        </div>
      )}

      {confirmingDelete && (
        <div className={styles.confirmPopover} role="dialog">
          <div className={styles.confirmHeader}>
            ¿Eliminar el grupo <strong>{groupName}</strong>?
          </div>
          <div className={styles.confirmHint}>
            Esta acción es permanente. Si el grupo tiene subgrupos hijos o
            vehículos asignados, no se podrá eliminar.
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
              className={styles.confirmBtn}
              onClick={handleConfirmDelete}
              disabled={isPending}
            >
              {isPending ? "Procesando…" : "Eliminar"}
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
