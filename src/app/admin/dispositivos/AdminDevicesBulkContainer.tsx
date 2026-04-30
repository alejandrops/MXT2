"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trash2, X, Star } from "lucide-react";
import type { DeviceListRow } from "@/lib/queries";
import { bulkDeleteAdminDevices } from "./actions";
import { DeviceActionsKebab } from "./DeviceActionsKebab";
import styles from "./AdminDevicesBulkContainer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminDevicesBulkContainer (H5b)
//  ─────────────────────────────────────────────────────────────
//  Wrapper de la tabla de devices con:
//   · Checkbox por fila + select all en el header
//   · Toolbar superior cuando hay selección · "Eliminar X"
//   · Confirmación · banner de resultado con detalle expandible
//
//  Mantiene el kebab de acciones por fila para CRUD individual
//  (editar / dar de baja, etc.) que ya tenía la versión H2.
// ═══════════════════════════════════════════════════════════════

const VENDOR_LABELS: Record<string, string> = {
  TELTONIKA: "Teltonika",
  QUECLINK: "Queclink",
  CONCOX: "Concox",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  STOCK: "Stock",
  INSTALLED: "Instalado",
  IN_REPAIR: "Reparación",
  DECOMMISSIONED: "Baja",
};

const COMM_STATE_LABELS: Record<string, string> = {
  ONLINE: "Online",
  RECENT: "Reciente",
  STALE: "Demorado",
  LONG: "Lejano",
  OFFLINE: "Offline",
};

function formatRelative(ms: number): string {
  if (ms === Infinity || ms < 0) return "—";
  const M = 60 * 1000;
  const H = 60 * M;
  const D = 24 * H;
  if (ms < M) return `${Math.floor(ms / 1000)}s`;
  if (ms < H) return `${Math.floor(ms / M)}m`;
  if (ms < D) return `${Math.floor(ms / H)}h`;
  return `${Math.floor(ms / D)}d`;
}

interface Props {
  rows: DeviceListRow[];
  userCanWrite: boolean;
}

interface DeleteResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}

export function AdminDevicesBulkContainer({ rows, userCanWrite }: Props) {
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
      const r = await bulkDeleteAdminDevices(ids);
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
              ? "dispositivo seleccionado"
              : "dispositivos seleccionados"}
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
              {selectedIds.size === 1 ? "dispositivo" : "dispositivos"}
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
              <th className={styles.th}>IMEI · Vendor</th>
              <th className={styles.th}>Vehículo</th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Última conexión</th>
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
                        aria-label={`Seleccionar ${d.imei}`}
                      />
                    </td>
                  )}
                  <td className={styles.td}>
                    <div className={styles.deviceCell}>
                      <span className={`${styles.mono} ${styles.deviceImei}`}>
                        {d.imei}
                      </span>
                      <span className={styles.deviceSub}>
                        {VENDOR_LABELS[d.vendor] ?? d.vendor} · {d.model}
                        {d.firmwareVersion && ` · fw ${d.firmwareVersion}`}
                        {d.isPrimary && (
                          <span className={styles.primaryChip}>
                            <Star size={9} /> primario
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    {d.asset ? (
                      <Link
                        href={`/admin/vehiculos?edit=${d.asset.id}`}
                        className={styles.assetLink}
                      >
                        <span className={styles.assetName}>{d.asset.name}</span>
                        <span className={styles.assetSub}>
                          {d.asset.plate ? (
                            <span className={styles.mono}>
                              {d.asset.plate}
                            </span>
                          ) : (
                            <span className={styles.placeholder}>
                              sin patente
                            </span>
                          )}
                          {d.asset.accountName && (
                            <span className={styles.dim}>
                              {" "}
                              · {d.asset.accountName}
                            </span>
                          )}
                        </span>
                      </Link>
                    ) : (
                      <span className={styles.placeholder}>Sin asignar</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <span
                      className={`${styles.statusChip} ${
                        d.status === "INSTALLED"
                          ? styles.statusInstalled
                          : d.status === "STOCK"
                            ? styles.statusStock
                            : d.status === "IN_REPAIR"
                              ? styles.statusRepair
                              : styles.statusDecom
                      }`}
                    >
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.commCell}>
                      <span
                        className={`${styles.commChip} ${
                          d.commState === "ONLINE"
                            ? styles.commOnline
                            : d.commState === "RECENT"
                              ? styles.commRecent
                              : d.commState === "STALE"
                                ? styles.commStale
                                : d.commState === "LONG"
                                  ? styles.commLong
                                  : styles.commOffline
                        }`}
                      >
                        {COMM_STATE_LABELS[d.commState] ?? d.commState}
                      </span>
                      <span className={styles.commTime}>
                        {d.lastSeenAt
                          ? `hace ${formatRelative(d.msSinceLastSeen)}`
                          : "Sin reportes"}
                      </span>
                    </div>
                  </td>
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    {userCanWrite ? (
                      <DeviceActionsKebab
                        deviceId={d.id}
                        imei={d.imei}
                        status={d.status}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.openBtn}
                        onClick={() => openRow(d.id)}
                        aria-label={`Ver ${d.imei}`}
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
              {selectedIds.size === 1 ? "dispositivo" : "dispositivos"}?
            </h3>
            <p className={styles.confirmHint}>
              Esta acción es <strong>irreversible</strong>. Los dispositivos en
              estado <em>INSTALLED</em> no se pueden eliminar · primero hay que
              desinstalarlos (cambiar a IN_REPAIR o DECOMMISSIONED). Si entre
              los seleccionados hay alguno instalado, la operación lo va a
              omitir y reportar como error.
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
