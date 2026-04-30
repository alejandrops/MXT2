"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trash2, X } from "lucide-react";
import type { SimListRow } from "@/lib/queries";
import { bulkDeleteAdminSims } from "./actions";
import { SimActionsKebab } from "./SimActionsKebab";
import styles from "./AdminSimsBulkContainer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminSimsBulkContainer (H5b)
//  ─────────────────────────────────────────────────────────────
//  Twin del bulk container de devices, adaptado a SIMs.
// ═══════════════════════════════════════════════════════════════

const CARRIER_LABELS: Record<string, string> = {
  MOVISTAR: "Movistar",
  CLARO: "Claro",
  PERSONAL: "Personal",
  ENTEL: "Entel",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  STOCK: "Stock",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

interface Props {
  rows: SimListRow[];
  userCanWrite: boolean;
}

interface DeleteResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}

export function AdminSimsBulkContainer({ rows, userCanWrite }: Props) {
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
      const r = await bulkDeleteAdminSims(ids);
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
            {selectedIds.size === 1 ? "SIM seleccionada" : "SIMs seleccionadas"}
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
              {selectedIds.size === 1 ? "SIM" : "SIMs"}
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
                      allSelected ? "Deseleccionar todas" : "Seleccionar todas"
                    }
                  />
                </th>
              )}
              <th className={styles.th}>ICCID · Teléfono</th>
              <th className={styles.th}>Carrier · APN</th>
              <th className={styles.th}>Plan</th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Asignación</th>
              <th className={styles.thAction} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isSelected = selectedIds.has(s.id);
              return (
                <tr
                  key={s.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                >
                  {userCanWrite && (
                    <td className={styles.tdCheckbox}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggle(s.id)}
                        aria-label={`Seleccionar ${s.iccid}`}
                      />
                    </td>
                  )}
                  <td className={styles.td}>
                    <div className={styles.simCell}>
                      <span className={`${styles.mono} ${styles.simIccid}`}>
                        {s.iccid}
                      </span>
                      <span className={styles.simSub}>
                        {s.phoneNumber ? (
                          <span className={styles.mono}>{s.phoneNumber}</span>
                        ) : (
                          <span className={styles.placeholder}>Sin teléfono</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.carrierCell}>
                      <span className={styles.carrierName}>
                        {CARRIER_LABELS[s.carrier] ?? s.carrier}
                      </span>
                      <span className={`${styles.mono} ${styles.apn}`}>
                        {s.apn}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.planChip}>
                      {s.dataPlanMb.toLocaleString("es-AR")} MB
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span
                      className={`${styles.statusChip} ${
                        s.status === "ACTIVE"
                          ? styles.statusActive
                          : s.status === "STOCK"
                            ? styles.statusStock
                            : s.status === "SUSPENDED"
                              ? styles.statusSuspended
                              : styles.statusCancelled
                      }`}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {s.device ? (
                      <Link
                        href={`/admin/dispositivos?edit=${s.device.id}`}
                        className={styles.deviceLink}
                      >
                        <span
                          className={`${styles.mono} ${styles.deviceImei}`}
                        >
                          {s.device.imei}
                        </span>
                        {s.device.assetName && (
                          <span className={styles.deviceSub}>
                            {s.device.assetName}
                            {s.device.accountName && (
                              <span className={styles.dim}>
                                {" "}
                                · {s.device.accountName}
                              </span>
                            )}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className={styles.placeholder}>Sin device</span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    {userCanWrite ? (
                      <SimActionsKebab
                        simId={s.id}
                        iccid={s.iccid}
                        status={s.status}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.openBtn}
                        onClick={() => openRow(s.id)}
                        aria-label={`Ver ${s.iccid}`}
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
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
              {selectedIds.size === 1 ? "SIM" : "SIMs"}?
            </h3>
            <p className={styles.confirmHint}>
              Esta acción es <strong>irreversible</strong>. Las SIMs en estado{" "}
              <em>ACTIVE</em> no se pueden eliminar · primero hay que
              desactivarlas (cambiar a SUSPENDED o CANCELLED). Si entre las
              seleccionadas hay alguna activa, la operación la va a omitir y
              reportar como error.
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
                {isPending ? "Eliminando…" : `Sí, eliminar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
