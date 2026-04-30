"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trash2, X } from "lucide-react";
import type { AdminAssetRow } from "@/lib/queries";
import { bulkDeleteAdminAssets } from "./actions";
import styles from "./AdminVehiclesBulkContainer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminVehiclesBulkContainer (H7c-2)
//  ─────────────────────────────────────────────────────────────
//  Wrapper de la tabla del backoffice con:
//   · Checkbox por fila + checkbox "select all" en el header
//   · Toolbar superior cuando hay selección con conteo y
//     botón "Eliminar X vehículos"
//   · Confirmación previa al delete
//   · Banner de resultado · ok/parcial/error con detalle expandible
// ═══════════════════════════════════════════════════════════════

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  GENERIC: "Genérico",
  CAR: "Auto",
  TRUCK: "Camión",
  MOTORCYCLE: "Moto",
  HEAVY_MACHINERY: "Maquinaria",
  TRAILER: "Trailer",
  SILO: "Silo",
};

const VENDOR_LABELS: Record<string, string> = {
  TELTONIKA: "Teltonika",
  QUECLINK: "Queclink",
  CONCOX: "Concox",
  OTHER: "Otro",
};

interface Props {
  rows: AdminAssetRow[];
  userCanWrite: boolean;
}

interface DeleteResult {
  ok: boolean;
  deleted: number;
  failed: number;
  errors: { id: string; name: string; message: string }[];
  message?: string;
}

export function AdminVehiclesBulkContainer({ rows, userCanWrite }: Props) {
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
      const r = await bulkDeleteAdminAssets(ids);
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
              ? "vehículo seleccionado"
              : "vehículos seleccionados"}
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
              {selectedIds.size === 1 ? "vehículo" : "vehículos"}
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
              <th className={styles.th}>Vehículo · Patente</th>
              <th className={styles.th}>Cliente</th>
              <th className={styles.th}>Tipo</th>
              <th className={styles.th}>Device</th>
              <th className={styles.th}>SIM</th>
              <th className={styles.thAction} aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const isSelected = selectedIds.has(a.id);
              return (
                <tr
                  key={a.id}
                  className={`${styles.row} ${isSelected ? styles.rowSelected : ""}`}
                >
                  {userCanWrite && (
                    <td className={styles.tdCheckbox}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={isSelected}
                        onChange={() => toggle(a.id)}
                        aria-label={`Seleccionar ${a.name}`}
                      />
                    </td>
                  )}
                  <td className={styles.td}>
                    <div className={styles.assetCell}>
                      <span className={styles.assetName}>{a.name}</span>
                      <span className={styles.assetSub}>
                        {a.plate ? (
                          <span className={styles.mono}>{a.plate}</span>
                        ) : (
                          <span className={styles.placeholder}>
                            Sin patente
                          </span>
                        )}
                        {a.make &&
                          ` · ${a.make}${a.model ? ` ${a.model}` : ""}`}
                        {a.year && ` · ${a.year}`}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>{a.account.name}</span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.typeChip}>
                      {VEHICLE_TYPE_LABELS[a.vehicleType]}
                    </span>
                  </td>
                  <td className={styles.td}>
                    {a.device ? (
                      <div className={styles.deviceCell}>
                        <span
                          className={`${styles.mono} ${styles.deviceImei}`}
                        >
                          {a.device.imei}
                        </span>
                        <span className={styles.deviceSub}>
                          {VENDOR_LABELS[a.device.vendor] ?? a.device.vendor}{" "}
                          · {a.device.model}
                          {a.device.firmwareVersion &&
                            ` · fw ${a.device.firmwareVersion}`}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.warningChip}>Sin device</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {a.sim ? (
                      <div className={styles.simCell}>
                        <span
                          className={`${styles.mono} ${styles.simIccid}`}
                        >
                          {a.sim.iccid.slice(-8)}
                        </span>
                        <span className={styles.simSub}>
                          {a.sim.carrier}
                          {a.sim.phoneNumber && ` · ${a.sim.phoneNumber}`}
                        </span>
                      </div>
                    ) : a.device ? (
                      <span className={styles.warningChip}>Sin SIM</span>
                    ) : (
                      <span className={styles.placeholder}>—</span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.tdAction}`}>
                    <button
                      type="button"
                      className={styles.openBtn}
                      onClick={() => openRow(a.id)}
                      aria-label={`Editar ${a.name}`}
                      title="Editar / ver detalle técnico"
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
              {selectedIds.size === 1 ? "vehículo" : "vehículos"}?
            </h3>
            <p className={styles.confirmHint}>
              Esta acción es <strong>irreversible</strong>. Para cada uno se
              eliminan trips, eventos, alarmas y posiciones registradas. Los
              dispositivos asignados quedan liberados (en estado
              &quot;En reparación&quot;) y pueden reasignarse desde{" "}
              <Link
                href="/admin/dispositivos"
                className={styles.confirmLink}
              >
                /admin/dispositivos
              </Link>
              .
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
