"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createAsset, updateAsset, type AssetInput } from "./actions";
import styles from "./AssetEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AssetEditDrawer · drawer lateral con form de create/edit
//  ─────────────────────────────────────────────────────────────
//  Modo "create" cuando initialAsset es null (asset nuevo).
//  Modo "edit"   cuando initialAsset tiene un id.
//
//  El cliente no se puede cambiar en modo edit · se hereda del
//  asset original. En create, si el user es CLIENT_ADMIN/OPERATOR
//  se fija al accountId scoped y el selector se oculta.
// ═══════════════════════════════════════════════════════════════

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  GENERIC: "Genérico",
  CAR: "Auto",
  TRUCK: "Camión",
  MOTORCYCLE: "Moto",
  HEAVY_MACHINERY: "Maquinaria pesada",
  TRAILER: "Trailer",
  SILO: "Silo",
};

const MOBILITY_LABELS: Record<string, string> = {
  MOBILE: "Móvil",
  FIXED: "Fijo",
};

export interface DrawerInitialAsset {
  id: string;
  accountId: string;
  groupId: string | null;
  currentDriverId: string | null;
  name: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  initialOdometerKm: number | null;
  vehicleType: string;
  mobilityType: string;
  status: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface GroupOption {
  id: string;
  name: string;
  accountId: string;
}

export interface DriverOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  /** Si null · modo crear · si presente · modo editar */
  initialAsset: DrawerInitialAsset | null;
  /** Lista de accounts a mostrar en selector. Si solo hay uno (user
   *  scoped) el selector se oculta y se usa ese. */
  accountOptions: AccountOption[];
  /** Lista de grupos · pre-cargada de todos los accounts del scope.
   *  El componente filtra por accountId al cambiar. */
  groupOptions: GroupOption[];
  /** Lista de conductores · idem, pre-cargada y filtrada cliente-side. */
  driverOptions: { id: string; firstName: string; lastName: string; accountId: string }[];
}

export function AssetEditDrawer({
  initialAsset,
  accountOptions,
  groupOptions,
  driverOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialAsset !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  // Account default: si edit, el del asset · si create, el primero
  const defaultAccountId = isEdit
    ? initialAsset!.accountId
    : accountOptions[0]?.id ?? "";

  const [accountId, setAccountId] = useState(defaultAccountId);
  const [groupId, setGroupId] = useState(initialAsset?.groupId ?? "");
  const [currentDriverId, setCurrentDriverId] = useState(
    initialAsset?.currentDriverId ?? "",
  );
  const [name, setName] = useState(initialAsset?.name ?? "");
  const [plate, setPlate] = useState(initialAsset?.plate ?? "");
  const [vin, setVin] = useState(initialAsset?.vin ?? "");
  const [make, setMake] = useState(initialAsset?.make ?? "");
  const [model, setModel] = useState(initialAsset?.model ?? "");
  const [year, setYear] = useState(
    initialAsset?.year != null ? String(initialAsset.year) : "",
  );
  const [initialOdometerKm, setInitialOdometerKm] = useState(
    initialAsset?.initialOdometerKm != null
      ? String(initialAsset.initialOdometerKm)
      : "",
  );
  const [vehicleType, setVehicleType] = useState(
    initialAsset?.vehicleType ?? "GENERIC",
  );
  const [mobilityType, setMobilityType] = useState(
    initialAsset?.mobilityType ?? "MOBILE",
  );
  // Toggle binario · true = MAINTENANCE
  // En create default false. En edit, derivado del status actual.
  const [inMaintenance, setInMaintenance] = useState(
    initialAsset?.status === "MAINTENANCE",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Cuando cambia accountId, filtrar groups y drivers · resetear
  // selectedGroupId / selectedDriverId si no pertenecen al nuevo
  // account
  const filteredGroups = groupOptions.filter((g) => g.accountId === accountId);
  const filteredDrivers = driverOptions.filter(
    (d) => d.accountId === accountId,
  );

  useEffect(() => {
    if (groupId && !filteredGroups.some((g) => g.id === groupId)) {
      setGroupId("");
    }
    if (
      currentDriverId &&
      !filteredDrivers.some((d) => d.id === currentDriverId)
    ) {
      setCurrentDriverId("");
    }
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar con ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function buildInput(): AssetInput {
    return {
      accountId,
      groupId: groupId || null,
      currentDriverId: currentDriverId || null,
      name,
      plate,
      vin,
      make,
      model,
      year,
      initialOdometerKm,
      vehicleType,
      mobilityType,
      inMaintenance,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateAsset(initialAsset!.id, input)
        : await createAsset(input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) {
          setGeneralError(result.message);
        }
      }
    });
  }

  // El selector de cliente se oculta si solo hay 1 opción (user
  // scoped a un cliente único) o si estamos editando (no se puede
  // cambiar el cliente de un asset existente)
  const showAccountSelect = !isEdit && accountOptions.length > 1;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar vehículo">
        {/* ── Header ──────────────────────────────────── */}
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar vehículo" : "Nuevo vehículo"}
            </span>
            {isEdit && (
              <span className={styles.headerName}>{initialAsset!.name}</span>
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

        {/* ── Body / Form ──────────────────────────────── */}
        <form onSubmit={handleSubmit} className={styles.body} noValidate>
          {generalError && (
            <div className={styles.alert}>{generalError}</div>
          )}

          {/* ── Sección 1 · Identificación ─────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Identificación</h3>

            {showAccountSelect && (
              <Field label="Cliente" required error={errors.accountId}>
                <select
                  className={styles.select}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={isPending}
                >
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Nombre" required error={errors.name}>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                maxLength={80}
                placeholder="Ej · Camión 12 · Volvo Norte"
              />
            </Field>

            <div className={styles.row2}>
              <Field label="Patente" error={errors.plate}>
                <input
                  type="text"
                  className={`${styles.input} ${styles.mono}`}
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  disabled={isPending}
                  maxLength={20}
                  placeholder="AB123CD"
                />
              </Field>
              <Field label="VIN" error={errors.vin}>
                <input
                  type="text"
                  className={`${styles.input} ${styles.mono}`}
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  disabled={isPending}
                  maxLength={30}
                />
              </Field>
            </div>

            <div className={styles.row3}>
              <Field label="Marca" error={errors.make}>
                <input
                  type="text"
                  className={styles.input}
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  disabled={isPending}
                  maxLength={40}
                />
              </Field>
              <Field label="Modelo" error={errors.model}>
                <input
                  type="text"
                  className={styles.input}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={isPending}
                  maxLength={40}
                />
              </Field>
              <Field label="Año" error={errors.year}>
                <input
                  type="number"
                  className={styles.input}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={isPending}
                  min={1900}
                  max={2100}
                  placeholder="2024"
                />
              </Field>
            </div>
          </div>

          {/* ── Sección 2 · Operación ─────────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Operación</h3>

            <div className={styles.row2}>
              <Field label="Tipo">
                <select
                  className={styles.select}
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  disabled={isPending}
                >
                  {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Movilidad">
                <select
                  className={styles.select}
                  value={mobilityType}
                  onChange={(e) => setMobilityType(e.target.value)}
                  disabled={isPending}
                >
                  {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Grupo" error={errors.groupId}>
              <select
                className={styles.select}
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={isPending}
              >
                <option value="">— Sin grupo —</option>
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Conductor asignado" error={errors.currentDriverId}>
              <select
                className={styles.select}
                value={currentDriverId}
                onChange={(e) => setCurrentDriverId(e.target.value)}
                disabled={isPending}
              >
                <option value="">— Sin conductor —</option>
                {filteredDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Odómetro al alta (km)"
              error={errors.initialOdometerKm}
              hint="Lectura del cuentakilómetros al alta · sirve para planes de mantenimiento por km. Opcional."
            >
              <input
                type="number"
                className={styles.input}
                value={initialOdometerKm}
                onChange={(e) => setInitialOdometerKm(e.target.value)}
                disabled={isPending}
                min={0}
                max={9999999}
                placeholder="125000"
              />
            </Field>

            {/* Toggle de mantenimiento · binario */}
            <Field
              label="Disponibilidad"
              hint={
                inMaintenance
                  ? "El vehículo no aparece en vistas operativas. Cuando vuelva a operar, destildá esto · el sistema va a actualizar el estado real automáticamente."
                  : "El estado operativo (en movimiento, detenido, sin señal) lo determina el dispositivo IoT automáticamente."
              }
            >
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={inMaintenance}
                  onChange={(e) => setInMaintenance(e.target.checked)}
                  disabled={isPending}
                />
                <span className={styles.toggleLabel}>
                  Está en mantenimiento (fuera de operación)
                </span>
              </label>
            </Field>
          </div>
        </form>

        {/* ── Footer ──────────────────────────────────── */}
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
                : "Crear vehículo"}
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
