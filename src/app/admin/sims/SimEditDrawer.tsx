"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CreditCard, AlertCircle } from "lucide-react";
import { createSim, updateSim, type SimInput } from "./actions";
import styles from "./SimEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  SimEditDrawer · crear/editar SIM
// ═══════════════════════════════════════════════════════════════

const CARRIER_INFO: Record<
  "MOVISTAR" | "CLARO" | "PERSONAL" | "ENTEL" | "OTHER",
  { label: string; defaultApn: string }
> = {
  MOVISTAR: { label: "Movistar", defaultApn: "internet.movistar.com.ar" },
  CLARO: { label: "Claro", defaultApn: "internet.ctimovil.com.ar" },
  PERSONAL: { label: "Personal", defaultApn: "internet.personal.com" },
  ENTEL: { label: "Entel", defaultApn: "internet.entel.cl" },
  OTHER: { label: "Otro", defaultApn: "" },
};

const STATUS_INFO: Record<
  "STOCK" | "ACTIVE" | "SUSPENDED" | "CANCELLED",
  { label: string; description: string; tone: "blue" | "grn" | "amb" | "gray" }
> = {
  STOCK: {
    label: "En stock",
    description: "Recibida del carrier, esperando asignación",
    tone: "blue",
  },
  ACTIVE: {
    label: "Activa",
    description: "Operando dentro de un dispositivo",
    tone: "grn",
  },
  SUSPENDED: {
    label: "Suspendida",
    description: "Pausada por el carrier · sin servicio",
    tone: "amb",
  },
  CANCELLED: {
    label: "Cancelada",
    description: "Dada de baja · no se reactiva",
    tone: "gray",
  },
};

const DATA_PLAN_PRESETS = [
  { value: 10, label: "10 MB" },
  { value: 50, label: "50 MB" },
  { value: 100, label: "100 MB" },
  { value: 250, label: "250 MB" },
  { value: 500, label: "500 MB" },
  { value: 1000, label: "1 GB" },
];

export interface DrawerInitialSim {
  id: string;
  iccid: string;
  phoneNumber: string | null;
  imsi: string | null;
  carrier: "MOVISTAR" | "CLARO" | "PERSONAL" | "ENTEL" | "OTHER";
  apn: string;
  dataPlanMb: number;
  status: "STOCK" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  deviceId: string | null;
  deviceImei: string | null;
  assetName: string | null;
  accountName: string | null;
}

export interface DeviceOption {
  id: string;
  imei: string;
  model: string;
  assetName: string | null;
  accountName: string | null;
}

interface Props {
  initialSim: DrawerInitialSim | null;
  deviceOptions: DeviceOption[];
}

export function SimEditDrawer({ initialSim, deviceOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialSim !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  const [iccid, setIccid] = useState(initialSim?.iccid ?? "");
  const [phoneNumber, setPhoneNumber] = useState(
    initialSim?.phoneNumber ?? "",
  );
  const [imsi, setImsi] = useState(initialSim?.imsi ?? "");
  const [carrier, setCarrier] = useState<DrawerInitialSim["carrier"]>(
    initialSim?.carrier ?? "MOVISTAR",
  );
  const [apn, setApn] = useState(
    initialSim?.apn ?? CARRIER_INFO.MOVISTAR.defaultApn,
  );
  const [dataPlanMb, setDataPlanMb] = useState(initialSim?.dataPlanMb ?? 50);
  const [status, setStatus] = useState<DrawerInitialSim["status"]>(
    initialSim?.status ?? "STOCK",
  );
  const [deviceId, setDeviceId] = useState<string>(
    initialSim?.deviceId ?? "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Cuando cambia el carrier, sugerir el APN si está vacío
  // o si tenía el default del carrier anterior
  useEffect(() => {
    if (!isEdit) {
      // Solo en create, autofill del APN si todavía no fue tocado o
      // si el actual coincide con un default conocido
      const currentDefault = Object.values(CARRIER_INFO).find(
        (c) => c.defaultApn === apn,
      );
      if (currentDefault) {
        setApn(CARRIER_INFO[carrier].defaultApn);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier]);

  // Si cambia el status, limpiar deviceId si corresponde
  useEffect(() => {
    if (status === "STOCK" || status === "CANCELLED") {
      if (deviceId !== "") setDeviceId("");
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

  function buildInput(): SimInput {
    return {
      iccid,
      phoneNumber,
      imsi,
      carrier,
      apn,
      dataPlanMb,
      status,
      deviceId: deviceId === "" ? null : deviceId,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateSim(initialSim!.id, input)
        : await createSim(input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setGeneralError(result.message);
      }
    });
  }

  const showDeviceSelect = status === "ACTIVE" || status === "SUSPENDED";
  const deviceRequired = status === "ACTIVE";

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar SIM" : "Nueva SIM"}
      >
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar SIM" : "Nueva SIM"}
            </span>
            {isEdit && (
              <span className={`${styles.headerName} ${styles.mono}`}>
                {initialSim!.iccid}
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

            <Field
              label="ICCID"
              required
              error={errors.iccid}
              hint="19 o 20 dígitos numéricos · impreso en el plástico"
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={`${styles.input} ${styles.mono}`}
                value={iccid}
                onChange={(e) =>
                  setIccid(e.target.value.replace(/\D/g, "").slice(0, 20))
                }
                disabled={isPending}
                maxLength={20}
                placeholder="89549012345678901234"
                autoFocus={!isEdit}
              />
            </Field>

            <div className={styles.row2}>
              <Field
                label="Número telefónico"
                error={errors.phoneNumber}
                hint="Si el carrier lo provee"
              >
                <input
                  type="tel"
                  className={`${styles.input} ${styles.mono}`}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isPending}
                  maxLength={30}
                  placeholder="+54 11 5555-0123"
                />
              </Field>
              <Field label="IMSI" error={errors.imsi} hint="Opcional">
                <input
                  type="text"
                  className={`${styles.input} ${styles.mono}`}
                  value={imsi}
                  onChange={(e) =>
                    setImsi(e.target.value.replace(/\D/g, "").slice(0, 30))
                  }
                  disabled={isPending}
                  maxLength={30}
                  placeholder="722340000000000"
                />
              </Field>
            </div>
          </div>

          {/* ── Carrier y plan ─────────────────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Carrier y plan de datos</h3>

            <Field label="Carrier" required error={errors.carrier}>
              <select
                className={styles.select}
                value={carrier}
                onChange={(e) =>
                  setCarrier(e.target.value as DrawerInitialSim["carrier"])
                }
                disabled={isPending}
              >
                {(
                  Object.keys(CARRIER_INFO) as Array<keyof typeof CARRIER_INFO>
                ).map((k) => (
                  <option key={k} value={k}>
                    {CARRIER_INFO[k].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="APN"
              required
              error={errors.apn}
              hint="Access Point Name · necesario para que el modem se conecte"
            >
              <input
                type="text"
                className={`${styles.input} ${styles.mono}`}
                value={apn}
                onChange={(e) => setApn(e.target.value)}
                disabled={isPending}
                maxLength={80}
                placeholder="internet.movistar.com.ar"
              />
            </Field>

            <Field
              label="Plan de datos (MB / mes)"
              required
              error={errors.dataPlanMb}
            >
              <div className={styles.dataPlanRow}>
                <input
                  type="number"
                  className={`${styles.input} ${styles.dataPlanInput}`}
                  value={dataPlanMb}
                  onChange={(e) => setDataPlanMb(Number(e.target.value) || 0)}
                  disabled={isPending}
                  min={1}
                  max={100000}
                />
                <div className={styles.presetGroup}>
                  {DATA_PLAN_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`${styles.preset} ${
                        dataPlanMb === p.value ? styles.presetActive : ""
                      }`}
                      onClick={() => setDataPlanMb(p.value)}
                      disabled={isPending}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          {/* ── Estado del ciclo de vida ─────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Estado</h3>

            <div className={styles.statusGrid}>
              {(
                ["STOCK", "ACTIVE", "SUSPENDED", "CANCELLED"] as const
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
          </div>

          {/* ── Asignación a device ──────────────────────── */}
          {showDeviceSelect && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Asignación</h3>

              <Field
                label="Dispositivo"
                required={deviceRequired}
                error={errors.deviceId}
                hint={
                  status === "SUSPENDED"
                    ? "Opcional · podés mantener el link aunque el carrier suspendió el servicio"
                    : "Dispositivo donde está físicamente insertada la SIM"
                }
              >
                <select
                  className={styles.select}
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">— Sin asignar —</option>
                  {deviceOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.imei} · {d.model}
                      {d.assetName ? ` → ${d.assetName}` : " (sin vehículo)"}
                      {d.accountName ? ` · ${d.accountName}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {deviceOptions.length === 0 && (
                <div className={styles.infoBox}>
                  <CreditCard size={14} className={styles.infoIcon} />
                  <div>
                    No hay dispositivos disponibles · todos tienen una SIM
                    asignada. Para asignar esta SIM a un device, primero
                    remové la SIM del device destino.
                  </div>
                </div>
              )}
            </div>
          )}

          {!showDeviceSelect && (
            <div className={styles.section}>
              <div className={styles.infoBox}>
                <CreditCard size={14} className={styles.infoIcon} />
                <div>
                  {status === "STOCK" && (
                    <>
                      <strong>En stock</strong> · esta SIM todavía no está
                      insertada en ningún dispositivo. Cuando se instale,
                      cambiala a <em>Activa</em> y asignala.
                    </>
                  )}
                  {status === "CANCELLED" && (
                    <>
                      <strong>Cancelada</strong> · esta SIM está dada de baja
                      · no se reactiva. Si seguís sin usarla, mejor eliminala.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning · ACTIVE sin device */}
          {status === "ACTIVE" && !deviceId && !errors.deviceId && (
            <div className={styles.section}>
              <div className={`${styles.infoBox} ${styles.warnBox}`}>
                <AlertCircle size={14} className={styles.warnIcon} />
                <div>
                  Tenés que seleccionar un dispositivo para guardar como{" "}
                  <em>Activa</em>.
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
                : "Crear SIM"}
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
