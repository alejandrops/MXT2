"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trash2, X } from "lucide-react";
import type { AdminDriverRow } from "@/lib/queries";
import { bulkDeleteAdminDrivers } from "./actions";
import styles from "./AdminDriversBulkContainer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminDriversBulkContainer (H7d) · selección + bulk delete
//  ─────────────────────────────────────────────────────────────
//  Mismo patrón que AdminVehiclesBulkContainer pero adaptado a
//  conductores. Al borrar conductores, los assets que los tenían
//  como currentDriver quedan sin conductor (no se rompen).
// ═══════════════════════════════════════════════════════════════

interface Props {
  rows: AdminDriverRow[];
  userCanWrite: boolean;
}

interface DeleteResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const y = d.getUTCFullYear();
  return `${day}/${m}/${y}`;
}

const LICENSE_LABELS: Record<AdminDriverRow["licenseStatus"], string> = {
  ok: "Vigente",
  expiring_soon: "Vence pronto",
  expired: "Vencida",
  unknown: "Sin registro",
};

export function AdminDriversBulkContainer({ rows, userCanWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const visibleIds = rows.map((r) => r.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));

  function toggle(id: string) {
    setResult(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setResult(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clear() {
    setSelectedIds(new Set());
    setResult(null);
    setShowErrors(false);
  }

  function openRow(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("edit", id);
    router.push(url.pathname + url.search, { scroll: false });
  }

  function handleBulkDelete() {
    setConfirming(false);
    setResult(null);
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const r = await bulkDeleteAdminDrivers(ids);
      setResult(r);
      if (r.failed === 0 && r.deleted > 0) {
        setSelectedIds(new Set());
      } else {
        const failedIds = new Set(r.errors.map((e) => e.id));
        setSelectedIds(failedIds);
      }
      router.refresh();
    });
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <>
      {hasSelection && userCanWrite && (
        <div className={styles.toolbar}>
          <span className={styles.count}>
            <strong>{selectedIds.size}</strong>{" "}
            {selectedIds.size === 1
              ? "conductor seleccionado"
              : "conductores seleccionados"}
          </span>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clear}
            disabled={isPending}
          >
            <X size={12} /> Limpiar
          </button>
          <div className={styles.spacer} />
          <button
            type="button"
            className={styles.bulkDeleteBtn}
            onClick={() => setConfirming(true)}
            disabled={isPending}
          >
            <Trash2 size={13} />
            <span>
              Eliminar {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "conductor" : "conductores"}
            </span>
          </button>
        </div>
      )}

      {result && (
        <div
          className={`${styles.banner} ${
            result.failed === 0
              ? styles.bannerOk
              : result.deleted === 0
                ? styles.bannerError
                : styles.bannerWarning
          }`}
        >
          <span className={styles.bannerMessage}>{result.message}</span>
          {result.errors.length > 0 && (
            <button
              type="button"
              className={styles.bannerDetailsBtn}
              onClick={() => setShowErrors((s) => !s)}
            >
              {showErrors ? "Ocultar detalle" : "Ver detalle"}
            </button>
          )}
          <button
            type="button"
            className={styles.bannerCloseBtn}
            onClick={() => {
              setResult(null);
              setShowErrors(false);
            }}
            aria-label="Cerrar"
          >
            <X size={12} />
          </button>
          {showErrors && result.errors.length > 0 && (
            <ul className={styles.errorList}>
              {result.errors.map((e) => (
                <li key={e.id} className={styles.errorItem}>
                  <strong>{e.name}</strong> · {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {userCanWrite && (
                <th className={styles.thCheckbox}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    ref={(el) => {
                      if (el)
                        el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={
                      allSelected ? "Deseleccionar todos" : "Seleccionar todos"
                    }
                  />
                </th>
              )}
              <th className={styles.th}>Conductor · Documento</th>
              <th className={styles.th}>Cliente</th>
              <th className={styles.th}>Asignación</th>
              <th className={styles.th}>Licencia</th>
              <th className={styles.thNum}>Score</th>
              <th className={styles.thNum}>Eventos 30d</th>
              <th className={styles.thAction} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const isSelected = selectedIds.has(d.id);
              return (
                <tr
                  key={d.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                >
                  {userCanWrite && (
                    <td className={styles.tdCheckbox}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggle(d.id)}
                        aria-label={`Seleccionar ${d.firstName} ${d.lastName}`}
                      />
                    </td>
                  )}
                  <td className={styles.td}>
                    <div className={styles.driverCell}>
                      <span className={styles.driverName}>
                        {d.firstName} {d.lastName}
                      </span>
                      <span className={styles.driverSub}>
                        {d.document ? (
                          <span className={styles.mono}>{d.document}</span>
                        ) : (
                          <span className={styles.placeholder}>
                            sin documento
                          </span>
                        )}
                        {d.hiredAt && (
                          <>
                            {" · "}
                            <span className={styles.dim}>
                              desde {formatDate(d.hiredAt)}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>{d.account.name}</span>
                  </td>
                  <td className={styles.td}>
                    {d.currentAsset ? (
                      <div className={styles.assetCell}>
                        <span className={styles.assetName}>
                          {d.currentAsset.name}
                        </span>
                        <span className={styles.assetSub}>
                          {d.currentAsset.plate ? (
                            <span className={styles.mono}>
                              {d.currentAsset.plate}
                            </span>
                          ) : (
                            <span className={styles.placeholder}>
                              sin patente
                            </span>
                          )}
                          {d.assetsAssignedCount > 1 &&
                            ` · +${d.assetsAssignedCount - 1} más`}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.placeholder}>Sin asignar</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span
                      className={`${styles.licenseChip} ${
                        d.licenseStatus === "expired"
                          ? styles.licenseExpired
                          : d.licenseStatus === "expiring_soon"
                            ? styles.licenseExpiring
                            : d.licenseStatus === "ok"
                              ? styles.licenseOk
                              : styles.licenseUnknown
                      }`}
                    >
                      {LICENSE_LABELS[d.licenseStatus]}
                    </span>
                    {d.licenseExpiresAt && (
                      <span className={styles.licenseDate}>
                        {formatDate(d.licenseExpiresAt)}
                      </span>
                    )}
                  </td>
                  <td className={styles.tdNum}>
                    <span
                      className={`${styles.scoreChip} ${
                        d.safetyScore >= 80
                          ? styles.scoreOk
                          : d.safetyScore >= 60
                            ? styles.scoreWarn
                            : styles.scoreBad
                      }`}
                    >
                      {d.safetyScore}
                    </span>
                  </td>
                  <td className={styles.tdNum}>
                    <span
                      className={
                        d.events30d > 10 ? styles.eventsHigh : styles.dim
                      }
                    >
                      {d.events30d.toLocaleString("es-AR")}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    <button
                      type="button"
                      className={styles.openBtn}
                      onClick={() => openRow(d.id)}
                      aria-label={`Editar ${d.firstName} ${d.lastName}`}
                      title="Editar / ver detalle"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div
          className={styles.confirmOverlay}
          onClick={() => setConfirming(false)}
        >
          <div
            className={styles.confirmDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.confirmTitle}>
              ¿Eliminar {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "conductor" : "conductores"}?
            </h3>
            <p className={styles.confirmHint}>
              Esta acción es <strong>irreversible</strong>. Los vehículos que
              tengan asignados quedarán <em>sin conductor</em>. Los viajes y
              eventos históricos se mantienen en el sistema (con el conductor
              en blanco) para preservar la trazabilidad.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleBulkDelete}
                disabled={isPending}
              >
                {isPending
                  ? "Eliminando…"
                  : `Sí, eliminar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
