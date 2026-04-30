"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Cpu, AlertCircle } from "lucide-react";
import {
  createDevice,
  updateDevice,
  type DeviceInput,
} from "./actions";
import styles from "./DeviceEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  DeviceEditDrawer · crear/editar Device
//  ─────────────────────────────────────────────────────────────
//  La UI del drawer maneja la lógica cruzada status ↔ assetId:
//   - STOCK / DECOMMISSIONED → bloquea selectbox de asset, lo limpia
//   - IN_REPAIR → asset opcional (puede preservar último o limpiar)
//   - INSTALLED → asset obligatorio
//
//  isPrimary aparece solo cuando status = INSTALLED y hay assetId
// ═══════════════════════════════════════════════════════════════

const VENDOR_INFO: Record<
  "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER",
  { label: string; modelHint: string }
> = {
  TELTONIKA: {
    label: "Teltonika",
    modelHint: "Ej · FMC130, FMB920, FMB964",
  },
  QUECLINK: {
    label: "Queclink",
    modelHint: "Ej · GV300W, GV58LAU",
  },
  CONCOX: {
    label: "Concox",
    modelHint: "Ej · GT06N, JM-VL01",
  },
  OTHER: {
    label: "Otro",
    modelHint: "Indicá vendor en notas internas",
  },
};

const STATUS_INFO: Record<
  "STOCK" | "INSTALLED" | "IN_REPAIR" | "DECOMMISSIONED",
  { label: string; description: string; tone: "blue" | "grn" | "amb" | "gray" }
> = {
  STOCK: {
    label: "En stock",
    description: "Recibido del proveedor, esperando instalación",
    tone: "blue",
  },
  INSTALLED: {
    label: "Instalado",
    description: "Operando en un vehículo · debe estar asignado",
    tone: "grn",
  },
  IN_REPAIR: {
    label: "En reparación",
    description: "Removido por falla, esperando service",
    tone: "amb",
  },
  DECOMMISSIONED: {
    label: "Dado de baja",
    description: "Vida útil terminada · no se reinstala",
    tone: "gray",
  },
};

export interface DrawerInitialDevice {
  id: string;
  imei: string;
  serialNumber: string | null;
  vendor: "TELTONIKA" | "QUECLINK" | "CONCOX" | "OTHER";
  model: string;
  firmwareVersion: string | null;
  status: "STOCK" | "INSTALLED" | "IN_REPAIR" | "DECOMMISSIONED";
  isPrimary: boolean;
  assetId: string | null;
  assetName: string | null;
  accountName: string | null;
}

export interface AssetOption {
  id: string;
  name: string;
  plate: string | null;
  accountName: string;
}

interface Props {
  initialDevice: DrawerInitialDevice | null;
  assetOptions: AssetOption[];
}

export function DeviceEditDrawer({ initialDevice, assetOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialDevice !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  const [imei, setImei] = useState(initialDevice?.imei ?? "");
  const [serialNumber, setSerialNumber] = useState(
    initialDevice?.serialNumber ?? "",
  );
  const [vendor, setVendor] = useState<DrawerInitialDevice["vendor"]>(
    initialDevice?.vendor ?? "TELTONIKA",
  );
  const [model, setModel] = useState(initialDevice?.model ?? "");
  const [firmwareVersion, setFirmwareVersion] = useState(
    initialDevice?.firmwareVersion ?? "",
  );
  const [status, setStatus] = useState<DrawerInitialDevice["status"]>(
    initialDevice?.status ?? "STOCK",
  );
  const [assetId, setAssetId] = useState<string>(
    initialDevice?.assetId ?? "",
  );
  const [isPrimary, setIsPrimary] = useState(
    initialDevice?.isPrimary ?? false,
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Cuando cambia el status, ajustar assetId / isPrimary automáticamente
  useEffect(() => {
    if (status === "STOCK" || status === "DECOMMISSIONED") {
      if (assetId !== "") setAssetId("");
      if (isPrimary) setIsPrimary(false);
    } else if (status !== "INSTALLED" && isPrimary) {
      setIsPrimary(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildInput(): DeviceInput {
    return {
      imei,
      serialNumber,
      vendor,
      model,
      firmwareVersion,
      status,
      assetId: assetId === "" ? null : assetId,
      isPrimary,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateDevice(initialDevice!.id, input)
        : await createDevice(input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setGeneralError(result.message);
      }
    });
  }

  const showAssetSelect = status === "INSTALLED" || status === "IN_REPAIR";
  const assetRequired = status === "INSTALLED";

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar dispositivo" : "Nuevo dispositivo"}
      >
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar dispositivo" : "Nuevo dispositivo"}
            </span>
            {isEdit && (
              <span className={`${styles.headerName} ${styles.mono}`}>
                {initialDevice!.imei}
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.body} noValidate>
          {generalError && <div className={styles.alert}>{generalError}</div>}

          {/* ── Identificación ────────────────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Identificación</h3>

            <Field label="IMEI" required error={errors.imei} hint="15 dígitos numéricos">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`${styles.input} ${styles.mono}`}
                value={imei}
                onChange={(e) =>
                  setImei(e.target.value.replace(/\D/g, "").slice(0, 15))
                }
                disabled={isPending}
                maxLength={15}
                placeholder="350612345678901"
                autoFocus={!isEdit}
              />
            </Field>

            <Field label="Número de serie" error={errors.serialNumber}>
              <input
                type="text"
                className={`${styles.input} ${styles.mono}`}
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={isPending}
                maxLength={40}
                placeholder="Opcional · si el vendor lo provee"
              />
            </Field>

            <div className={styles.row2}>
              <Field label="Vendor" required error={errors.vendor}>
                <select
                  className={styles.select}
                  value={vendor}
                  onChange={(e) =>
                    setVendor(e.target.value as DrawerInitialDevice["vendor"])
                  }
                  disabled={isPending}
                >
                  {(Object.keys(VENDOR_INFO) as Array<keyof typeof VENDOR_INFO>).map(
                    (k) => (
                      <option key={k} value={k}>
                        {VENDOR_INFO[k].label}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field
                label="Modelo"
                required
                error={errors.model}
                hint={VENDOR_INFO[vendor].modelHint}
              >
                <input
                  type="text"
                  className={styles.input}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isPending}
                  maxLength={60}
                  placeholder="FMC130"
                />
              </Field>
            </div>

            <Field
              label="Versión de firmware"
              error={errors.firmwareVersion}
              hint="Útil para troubleshooting · ej · 03.27.07.Rev.00"
            >
              <input
                type="text"
                className={`${styles.input} ${styles.mono}`}
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                disabled={isPending}
                maxLength={40}
                placeholder="03.27.07.Rev.00"
              />
            </Field>
          </div>

          {/* ── Estado del ciclo de vida ─────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Estado del ciclo de vida</h3>

            <div className={styles.statusGrid}>
              {(
                [
                  "STOCK",
                  "INSTALLED",
                  "IN_REPAIR",
                  "DECOMMISSIONED",
                ] as const
              ).map((s) => {
                const info = STATUS_INFO[s];
                const selected = status === s;
                return (
                  <label
                    key={s}
                    className={`${styles.statusCard} ${selected ? styles.statusCardSelected : ""}`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={selected}
                      onChange={() => setStatus(s)}
                      disabled={isPending}
                      className={styles.statusRadio}
                    />
                    <div className={styles.statusContent}>
                      <span
                        className={`${styles.statusName} ${styles[`tone_${info.tone}`]}`}
                      >
                        {info.label}
                      </span>
                      <span className={styles.statusDesc}>
                        {info.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.status && (
              <span className={styles.fieldError}>{errors.status}</span>
            )}
          </div>

          {/* ── Asignación a vehículo ─────────────────── */}
          {showAssetSelect && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Asignación</h3>

              <Field
                label="Vehículo"
                required={assetRequired}
                error={errors.assetId}
                hint={
                  status === "IN_REPAIR"
                    ? "Opcional · podés mantener la asignación o limpiarla"
                    : "Vehículo donde está físicamente instalado"
                }
              >
                <select
                  className={styles.select}
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">— Sin asignar —</option>
                  {assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} · {a.name}
                      {a.plate ? ` (${a.plate})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {status === "INSTALLED" && assetId && (
                <Field
                  label="Dispositivo principal"
                  hint="Cuando un vehículo tiene varios dispositivos (GPS + cámara, GPS + sensor combustible), uno actúa como principal para reportar posiciones"
                  error={errors.isPrimary}
                >
                  <label className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isPrimary}
                      onChange={(e) => setIsPrimary(e.target.checked)}
                      disabled={isPending}
                    />
                    <span className={styles.toggleLabel}>
                      Es el dispositivo principal del vehículo
                    </span>
                  </label>
                </Field>
              )}
            </div>
          )}

          {/* ── Hint informativo cuando no hay asignación ── */}
          {!showAssetSelect && (
            <div className={styles.section}>
              <div className={styles.infoBox}>
                <Cpu size={14} className={styles.infoIcon} />
                <div>
                  {status === "STOCK" && (
                    <>
                      <strong>En stock</strong> · este dispositivo todavía no
                      está instalado en ningún vehículo. Cuando lo instales,
                      cambialo a <em>Instalado</em> y asignalo.
                    </>
                  )}
                  {status === "DECOMMISSIONED" && (
                    <>
                      <strong>Dado de baja</strong> · este dispositivo no se
                      reinstala. Si está en stock pero ya no se usa, mejor
                      eliminalo en lugar de marcarlo como dado de baja.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Warning si está INSTALLED pero sin asset (transitorio) ── */}
          {status === "INSTALLED" && !assetId && !errors.assetId && (
            <div className={styles.section}>
              <div className={`${styles.infoBox} ${styles.warnBox}`}>
                <AlertCircle size={14} className={styles.warnIcon} />
                <div>
                  Tenés que seleccionar un vehículo para guardar como{" "}
                  <em>Instalado</em>.
                </div>
              </div>
            </div>
          )}
        </form>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear dispositivo"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}> *</span>}
      </label>
      {children}
      {error ? (
        <span className={styles.fieldError}>{error}</span>
      ) : hint ? (
        <span className={styles.fieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}
