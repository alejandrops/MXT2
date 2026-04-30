"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle } from "lucide-react";
import styles from "./DeleteAllMatchingDialog.module.css";

// ═══════════════════════════════════════════════════════════════
//  DeleteAllMatchingDialog (H5b) · componente compartido
//  ─────────────────────────────────────────────────────────────
//  Usado en los 4 backoffices (vehículos, conductores, devices,
//  sims) para "eliminar todo lo filtrado".
//
//  Diseño UX:
//   · Trigger button visible junto al filter bar, solo cuando hay
//     filtros activos Y el listResult.total > 0 Y userCanWrite.
//   · Al click → dialog de confirmación con:
//     - Count exacto del total de matches
//     - Lista de filtros activos (resumida)
//     - Warning rojo si count > 100 + input "tipear ELIMINAR"
//     - Si count ≤ 100, basta con confirmar con un solo click
//   · Resultado vuelve con summary: deleted / failed / errors[].
//
//  El componente NO sabe nada del dominio · cada page le pasa la
//  configuración (entityName, count, filterChips, action).
// ═══════════════════════════════════════════════════════════════

export interface DeleteAllMatchingResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors?: { id: string; name: string; message: string }[];
  message?: string;
}

interface Props {
  /** "vehículo" / "conductor" / "dispositivo" / "SIM" */
  entityNameSingular: string;
  /** "vehículos" / "conductores" / "dispositivos" / "SIMs" */
  entityNamePlural: string;
  /** Cantidad total que será eliminada */
  count: number;
  /** Resumen de los filtros activos · si está vacío, asume "todos" */
  activeFilterChips: { label: string; value: string }[];
  /** Acción que ejecuta el delete · NO recibe parámetros porque los filtros
      ya quedan capturados en el closure de la página padre */
  action: () => Promise<DeleteAllMatchingResult>;
}

const HARD_CONFIRM_THRESHOLD = 100;

export function DeleteAllMatchingDialog({
  entityNameSingular,
  entityNamePlural,
  count,
  activeFilterChips,
  action,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<DeleteAllMatchingResult | null>(null);

  const requiresHardConfirm = count > HARD_CONFIRM_THRESHOLD;
  const hardConfirmOk = !requiresHardConfirm || confirmText.trim() === "ELIMINAR";

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isPending]);

  function handleOpen() {
    setIsOpen(true);
    setConfirmText("");
    setResult(null);
  }

  function handleClose() {
    if (isPending) return;
    setIsOpen(false);
    setConfirmText("");
    if (result?.ok) {
      router.refresh();
    }
  }

  function handleConfirm() {
    if (!hardConfirmOk) return;
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if (r.ok) {
        router.refresh();
      }
    });
  }

  // Si no hay nada que eliminar, no mostrar el botón
  if (count === 0) return null;

  return (
    <>
      <button
        type="button"
        className={styles.triggerBtn}
        onClick={handleOpen}
        title={`Eliminar todos los ${entityNamePlural} que coinciden con los filtros`}
      >
        <Trash2 size={12} />
        <span>
          Eliminar {count.toLocaleString("es-AR")}{" "}
          {count === 1 ? entityNameSingular : entityNamePlural} filtrado
          {count === 1 ? "" : "s"}
        </span>
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={handleClose}>
          <div
            className={styles.dialog}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {result === null ? (
              <>
                <header className={styles.header}>
                  <div className={styles.headerIcon}>
                    <AlertTriangle size={18} />
                  </div>
                  <h3 className={styles.title}>
                    ¿Eliminar {count.toLocaleString("es-AR")}{" "}
                    {count === 1 ? entityNameSingular : entityNamePlural}?
                  </h3>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
                    disabled={isPending}
                    aria-label="Cerrar"
                  >
                    <X size={14} />
                  </button>
                </header>

                <div className={styles.body}>
                  <p className={styles.warning}>
                    Esta acción es <strong>irreversible</strong>. Vas a eliminar
                    todos los <strong>{entityNamePlural}</strong> que coinciden
                    con los filtros activos.
                  </p>

                  <div className={styles.filtersBox}>
                    <span className={styles.filtersLabel}>
                      Filtros activos:
                    </span>
                    {activeFilterChips.length === 0 ? (
                      <div className={styles.noFilters}>
                        <AlertTriangle
                          size={14}
                          className={styles.noFiltersIcon}
                        />
                        <span>
                          <strong>Sin filtros activos</strong> · vas a eliminar{" "}
                          <strong>TODOS</strong> los {entityNamePlural} del
                          sistema
                        </span>
                      </div>
                    ) : (
                      <div className={styles.filterChips}>
                        {activeFilterChips.map((c, i) => (
                          <span key={i} className={styles.filterChip}>
                            <span className={styles.filterChipLabel}>
                              {c.label}:
                            </span>{" "}
                            {c.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {requiresHardConfirm && (
                    <div className={styles.hardConfirm}>
                      <label className={styles.hardConfirmLabel}>
                        Confirmá tipeando <code>ELIMINAR</code> abajo:
                      </label>
                      <input
                        type="text"
                        className={styles.hardConfirmInput}
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="ELIMINAR"
                        autoComplete="off"
                        autoFocus
                        disabled={isPending}
                      />
                    </div>
                  )}
                </div>

                <footer className={styles.footer}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={handleClose}
                    disabled={isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={handleConfirm}
                    disabled={isPending || !hardConfirmOk}
                  >
                    {isPending ? (
                      <>Eliminando…</>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        Sí, eliminar {count.toLocaleString("es-AR")}
                      </>
                    )}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <header className={styles.header}>
                  <h3 className={styles.title}>Resultado</h3>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
                    aria-label="Cerrar"
                  >
                    <X size={14} />
                  </button>
                </header>

                <div className={styles.body}>
                  <div
                    className={`${styles.resultBanner} ${
                      result.failed === 0
                        ? styles.resultOk
                        : result.deleted === 0
                          ? styles.resultError
                          : styles.resultWarning
                    }`}
                  >
                    {result.message ??
                      `${result.deleted} eliminados · ${result.failed} fallaron`}
                  </div>

                  {result.errors && result.errors.length > 0 && (
                    <div className={styles.errorListWrap}>
                      <span className={styles.errorListLabel}>
                        Detalle de fallos ({result.errors.length}):
                      </span>
                      <ul className={styles.errorList}>
                        {result.errors.slice(0, 20).map((e) => (
                          <li key={e.id} className={styles.errorItem}>
                            <strong>{e.name}</strong> · {e.message}
                          </li>
                        ))}
                        {result.errors.length > 20 && (
                          <li className={styles.errorItemMuted}>
                            … y {result.errors.length - 20} más
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <footer className={styles.footer}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={handleClose}
                  >
                    Cerrar
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
