"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronDown,
  ChevronRight,
  Truck,
  Building2,
  Cpu,
  CreditCard,
  Wrench,
  Terminal,
  ExternalLink,
  Pencil,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  updateAdminAsset,
  deleteAdminAsset,
  type AdminAssetUpdateInput,
} from "./actions";
import styles from "./AdminAssetDrawer.module.css";

interface DrawerAsset {
  id: string;
  name: string;
  plate: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: string;
  mobilityType: "MOBILE" | "FIXED";
  initialOdometerKm: number | null;
  status: string;
  account: { id: string; name: string; slug: string };
  group: { id: string; name: string } | null;
  currentDriver: { id: string; firstName: string; lastName: string } | null;
  devices: {
    id: string;
    imei: string;
    serialNumber: string | null;
    vendor: string;
    model: string;
    firmwareVersion: string | null;
    status: string;
    isPrimary: boolean;
    lastSeenAt: Date | null;
    installedAt: Date;
    sim: {
      id: string;
      iccid: string;
      phoneNumber: string | null;
      carrier: string;
      apn: string;
      dataPlanMb: number;
      status: string;
    } | null;
  }[];
}

interface Props {
  asset: DrawerAsset;
  accountOptions: { id: string; name: string }[];
  groupOptions: { id: string; name: string; accountId: string }[];
  driverOptions: {
    id: string;
    firstName: string;
    lastName: string;
    accountId: string;
  }[];
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  GENERIC: "Genérico",
  CAR: "Auto",
  TRUCK: "Camión",
  MOTORCYCLE: "Moto",
  HEAVY_MACHINERY: "Maquinaria pesada",
  TRAILER: "Trailer",
  SILO: "Silo",
};

const STATUS_LABELS: Record<string, string> = {
  MOVING: "En movimiento",
  IDLE: "Detenido",
  STOPPED: "Estacionado",
  OFFLINE: "Sin señal",
  MAINTENANCE: "Mantenimiento",
};

const VENDOR_LABELS: Record<string, string> = {
  TELTONIKA: "Teltonika",
  QUECLINK: "Queclink",
  CONCOX: "Concox",
  OTHER: "Otro",
};

const DEVICE_STATUS_LABELS: Record<string, string> = {
  STOCK: "En stock",
  INSTALLED: "Instalado",
  IN_REPAIR: "En reparación",
  DECOMMISSIONED: "Dado de baja",
};

const SIM_STATUS_LABELS: Record<string, string> = {
  STOCK: "En stock",
  ACTIVE: "Activa",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

export function AdminAssetDrawer({
  asset,
  accountOptions,
  groupOptions,
  driverOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(asset.name);
  const [plate, setPlate] = useState(asset.plate ?? "");
  const [vin, setVin] = useState(asset.vin ?? "");
  const [make, setMake] = useState(asset.make ?? "");
  const [model, setModel] = useState(asset.model ?? "");
  const [year, setYear] = useState(asset.year?.toString() ?? "");
  const [vehicleType, setVehicleType] = useState(asset.vehicleType);
  const [mobilityType, setMobilityType] = useState<"MOBILE" | "FIXED">(
    asset.mobilityType,
  );
  const [initialOdometerKm, setInitialOdometerKm] = useState(
    asset.initialOdometerKm?.toString() ?? "",
  );
  const [accountId, setAccountId] = useState(asset.account.id);
  const [groupId, setGroupId] = useState(asset.group?.id ?? "");
  const [currentDriverId, setCurrentDriverId] = useState(
    asset.currentDriver?.id ?? "",
  );
  const [status, setStatus] = useState(asset.status);

  // Tipo objeto literal · evita undefined por noUncheckedIndexedAccess
  const [openSections, setOpenSections] = useState({
    identification: true,
    commercial: true,
    devices: true,
    accessories: false,
    commands: false,
  });

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (confirmingDelete) {
          setConfirmingDelete(false);
        } else if (mode === "edit") {
          setMode("view");
          setErrors({});
          setErrorMsg(null);
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, confirmingDelete]);

  type SectionKey = keyof typeof openSections;
  function toggle(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key as SectionKey] }));
  }

  const filteredGroups = groupOptions.filter((g) => g.accountId === accountId);
  const filteredDrivers = driverOptions.filter(
    (d) => d.accountId === accountId,
  );

  useEffect(() => {
    if (
      groupId &&
      !groupOptions.find((g) => g.id === groupId && g.accountId === accountId)
    ) {
      setGroupId("");
    }
    if (
      currentDriverId &&
      !driverOptions.find(
        (d) => d.id === currentDriverId && d.accountId === accountId,
      )
    ) {
      setCurrentDriverId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function handleSave() {
    setErrors({});
    setErrorMsg(null);

    // Conversiones cliente → tipos del server
    const yearNum = year.trim().length > 0 ? parseInt(year, 10) : null;
    const odometerNum =
      initialOdometerKm.trim().length > 0
        ? parseInt(initialOdometerKm.replace(/[.,\s]/g, ""), 10)
        : null;

    const input: AdminAssetUpdateInput = {
      name,
      plate,
      vin,
      make,
      model,
      year: Number.isFinite(yearNum as number) ? (yearNum as number) : null,
      vehicleType: vehicleType as AdminAssetUpdateInput["vehicleType"],
      mobilityType,
      initialOdometerKm: Number.isFinite(odometerNum as number)
        ? (odometerNum as number)
        : null,
      accountId,
      groupId: groupId || null,
      currentDriverId: currentDriverId || null,
      status: status as AdminAssetUpdateInput["status"],
    };

    startTransition(async () => {
      const result = await updateAdminAsset(asset.id, input);
      if (result.ok) {
        setMode("view");
        setOkMsg(result.message ?? "Vehículo actualizado");
        router.refresh();
        setTimeout(() => setOkMsg(null), 3000);
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setErrorMsg(result.message);
      }
    });
  }

  function handleCancelEdit() {
    setMode("view");
    setErrors({});
    setErrorMsg(null);
    setName(asset.name);
    setPlate(asset.plate ?? "");
    setVin(asset.vin ?? "");
    setMake(asset.make ?? "");
    setModel(asset.model ?? "");
    setYear(asset.year?.toString() ?? "");
    setVehicleType(asset.vehicleType);
    setMobilityType(asset.mobilityType);
    setInitialOdometerKm(asset.initialOdometerKm?.toString() ?? "");
    setAccountId(asset.account.id);
    setGroupId(asset.group?.id ?? "");
    setCurrentDriverId(asset.currentDriver?.id ?? "");
    setStatus(asset.status);
  }

  function handleDelete() {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await deleteAdminAsset(asset.id);
      if (result.ok) {
        setConfirmingDelete(false);
        router.refresh();
        onClose();
      } else {
        setConfirmingDelete(false);
        setErrorMsg(result.message ?? "Error al eliminar");
      }
    });
  }

  const primaryDevice =
    asset.devices.find((d) => d.isPrimary) ?? asset.devices[0] ?? null;
  const otherDevices = asset.devices.filter(
    (d) => d.id !== primaryDevice?.id,
  );
  const isEdit = mode === "edit";
  const canDelete = asset.devices.length === 0;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Editar vehículo" : "Nuevo vehículo"}
      >
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar vehículo" : "Detalle técnico"}
            </span>
            <span className={styles.headerName}>{asset.name}</span>
            {asset.plate && !isEdit && (
              <span className={styles.headerPlate}>{asset.plate}</span>
            )}
          </div>
          <div className={styles.headerActions}>
            {!isEdit && (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setMode("edit")}
                  title="Editar campos comerciales"
                >
                  <Pencil size={13} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => setConfirmingDelete(true)}
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? "Eliminar vehículo"
                      : "No se puede · primero remové los devices asignados"
                  }
                >
                  <Trash2 size={13} />
                  <span>Eliminar</span>
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {okMsg && <div className={styles.okBanner}>{okMsg}</div>}
        {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}

        <div className={styles.body}>
          {/* ── 1. Identificación ─────────────────────────────── */}
          <Section
            icon={<Truck size={14} />}
            title="Identificación"
            sectionKey="identification"
            open={openSections.identification}
            onToggle={toggle}
          >
            {isEdit ? (
              <>
                <EditField label="Nombre" required error={errors.name}>
                  <input
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isPending}
                    maxLength={80}
                    placeholder="Ej · Volvo FH540 #1"
                    autoFocus
                  />
                </EditField>
                <FieldRow>
                  <EditField label="Patente" error={errors.plate}>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.mono}`}
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      disabled={isPending}
                      maxLength={20}
                      placeholder="AB123CD"
                    />
                  </EditField>
                  <EditField label="VIN" error={errors.vin}>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.mono}`}
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      disabled={isPending}
                      maxLength={30}
                      placeholder="17 caracteres alfanuméricos"
                    />
                  </EditField>
                </FieldRow>
                <FieldRow>
                  <EditField label="Marca" error={errors.make}>
                    <input
                      type="text"
                      className={styles.input}
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      disabled={isPending}
                      maxLength={60}
                      placeholder="Volvo, Scania, Mercedes…"
                    />
                  </EditField>
                  <EditField label="Modelo" error={errors.model}>
                    <input
                      type="text"
                      className={styles.input}
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={isPending}
                      maxLength={60}
                      placeholder="FH540, R450…"
                    />
                  </EditField>
                  <EditField label="Año" error={errors.year}>
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
                  </EditField>
                </FieldRow>
                <FieldRow>
                  <EditField label="Tipo" error={errors.vehicleType}>
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
                  </EditField>
                  <EditField label="Movilidad" error={errors.mobilityType}>
                    <select
                      className={styles.select}
                      value={mobilityType}
                      onChange={(e) =>
                        setMobilityType(e.target.value as "MOBILE" | "FIXED")
                      }
                      disabled={isPending}
                    >
                      <option value="MOBILE">Móvil</option>
                      <option value="FIXED">Fijo</option>
                    </select>
                  </EditField>
                  <EditField
                    label="Odómetro inicial (km)"
                    error={errors.initialOdometerKm}
                  >
                    <input
                      type="number"
                      className={styles.input}
                      value={initialOdometerKm}
                      onChange={(e) => setInitialOdometerKm(e.target.value)}
                      disabled={isPending}
                      min={0}
                      max={9999999}
                      placeholder="0"
                    />
                  </EditField>
                </FieldRow>
              </>
            ) : (
              <>
                <Field label="Nombre" value={asset.name} />
                <FieldRow>
                  <Field label="Patente" value={asset.plate} mono />
                  <Field label="VIN" value={asset.vin} mono />
                </FieldRow>
                <FieldRow>
                  <Field label="Marca" value={asset.make} />
                  <Field label="Modelo" value={asset.model} />
                  <Field label="Año" value={asset.year?.toString() ?? null} />
                </FieldRow>
                <FieldRow>
                  <Field
                    label="Tipo"
                    value={
                      VEHICLE_TYPE_LABELS[asset.vehicleType] ?? asset.vehicleType
                    }
                  />
                  <Field
                    label="Movilidad"
                    value={asset.mobilityType === "MOBILE" ? "Móvil" : "Fijo"}
                  />
                  <Field
                    label="Odómetro inicial"
                    value={
                      asset.initialOdometerKm
                        ? `${asset.initialOdometerKm.toLocaleString("es-AR")} km`
                        : null
                    }
                  />
                </FieldRow>
              </>
            )}
          </Section>

          {/* ── 2. Comercial ─────────────────────────────────── */}
          <Section
            icon={<Building2 size={14} />}
            title="Comercial"
            sectionKey="commercial"
            open={openSections.commercial}
            onToggle={toggle}
          >
            {isEdit ? (
              <>
                <EditField
                  label="Cliente"
                  required
                  error={errors.accountId}
                  hint="Cambiar el cliente reasigna el vehículo · solo Maxtracker debería hacerlo"
                >
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
                </EditField>
                <FieldRow>
                  <EditField label="Grupo" error={errors.groupId}>
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
                  </EditField>
                  <EditField
                    label="Conductor asignado"
                    error={errors.currentDriverId}
                  >
                    <select
                      className={styles.select}
                      value={currentDriverId}
                      onChange={(e) => setCurrentDriverId(e.target.value)}
                      disabled={isPending}
                    >
                      <option value="">— Sin asignar —</option>
                      {filteredDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.firstName} {d.lastName}
                        </option>
                      ))}
                    </select>
                  </EditField>
                </FieldRow>
                <EditField label="Estado operativo" error={errors.status}>
                  <select
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isPending}
                  >
                    <option value="MOVING">En movimiento</option>
                    <option value="IDLE">Detenido</option>
                    <option value="STOPPED">Estacionado</option>
                    <option value="OFFLINE">Sin señal</option>
                    <option value="MAINTENANCE">Mantenimiento</option>
                  </select>
                </EditField>
              </>
            ) : (
              <>
                <Field
                  label="Cliente"
                  value={asset.account.name}
                  link={`/admin/clientes?edit=${asset.account.id}`}
                />
                <FieldRow>
                  <Field label="Grupo" value={asset.group?.name ?? null} />
                  <Field
                    label="Conductor asignado"
                    value={
                      asset.currentDriver
                        ? `${asset.currentDriver.firstName} ${asset.currentDriver.lastName}`
                        : null
                    }
                  />
                </FieldRow>
                <Field
                  label="Estado operativo"
                  value={STATUS_LABELS[asset.status] ?? asset.status}
                />
              </>
            )}
          </Section>

          {/* ── 3. Devices asignados ──────────────────────────── */}
          <Section
            icon={<Cpu size={14} />}
            title={`Dispositivos asignados (${asset.devices.length})`}
            sectionKey="devices"
            open={openSections.devices}
            onToggle={toggle}
          >
            {asset.devices.length === 0 ? (
              <div className={styles.emptyDevice}>
                Este vehículo no tiene ningún dispositivo asignado.{" "}
                <Link href="/admin/dispositivos" className={styles.inlineLink}>
                  Asignar uno
                </Link>
              </div>
            ) : (
              <>
                {primaryDevice && (
                  <DeviceCard device={primaryDevice} primary />
                )}
                {otherDevices.map((d) => (
                  <DeviceCard key={d.id} device={d} primary={false} />
                ))}
              </>
            )}
          </Section>

          {/* ── 4. Accesorios · placeholder ───────────────────── */}
          <Section
            icon={<Wrench size={14} />}
            title="Accesorios"
            sectionKey="accessories"
            open={openSections.accessories}
            onToggle={toggle}
          >
            <div className={styles.placeholder}>
              <span className={styles.placeholderLabel}>Próximamente</span>
              <span className={styles.placeholderHint}>
                Sensores adicionales (combustible, temperatura, RPM, puerta abierta),
                cámaras, lectores RFID/Dallas, módulos CAN-bus. Cada accesorio
                conectado al device principal.
              </span>
            </div>
          </Section>

          {/* ── 5. Comandos · placeholder ─────────────────────── */}
          <Section
            icon={<Terminal size={14} />}
            title="Comandos remotos"
            sectionKey="commands"
            open={openSections.commands}
            onToggle={toggle}
          >
            <div className={styles.placeholder}>
              <span className={styles.placeholderLabel}>Próximamente</span>
              <span className={styles.placeholderHint}>
                Envío de comandos al device · cortar combustible (relay), reinicio
                remoto, solicitar posición ahora, configurar geo-cercas, ajustar
                frecuencia de reporte. Historial de comandos enviados con confirmación.
              </span>
            </div>
          </Section>
        </div>

        <footer className={styles.footer}>
          {isEdit ? (
            <>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelEdit}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={isPending}
              >
                <Save size={13} />
                <span>{isPending ? "Guardando…" : "Guardar cambios"}</span>
              </button>
            </>
          ) : (
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cerrar
            </button>
          )}
        </footer>

        {confirmingDelete && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <h3 className={styles.confirmTitle}>
                ¿Eliminar el vehículo <strong>{asset.name}</strong>?
              </h3>
              <p className={styles.confirmHint}>
                Esta acción es definitiva · borra el vehículo y todo su
                historial (trips, eventos, posiciones, alarmas).
                {!canDelete && (
                  <>
                    <br />
                    <strong>No se puede eliminar</strong> · primero remové los{" "}
                    {asset.devices.length}{" "}
                    {asset.devices.length === 1 ? "device" : "devices"}{" "}
                    asignado{asset.devices.length === 1 ? "" : "s"} desde{" "}
                    /admin/dispositivos.
                  </>
                )}
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {isPending ? "Eliminando…" : "Eliminar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Section({
  icon,
  title,
  sectionKey,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sectionKey: string;
  open: boolean;
  onToggle: (k: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => onToggle(sectionKey)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.fieldRow}>{children}</div>;
}

function EditField({
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
    <div className={styles.editField}>
      <label className={styles.editFieldLabel}>
        {label}
        {required && <span className={styles.editFieldRequired}> *</span>}
      </label>
      {children}
      {error ? (
        <span className={styles.editFieldError}>{error}</span>
      ) : hint ? (
        <span className={styles.editFieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  link?: string;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {value ? (
        link ? (
          <Link href={link} className={styles.fieldLink}>
            <span className={mono ? styles.fieldValueMono : styles.fieldValue}>
              {value}
            </span>
            <ExternalLink size={11} className={styles.linkIcon} />
          </Link>
        ) : (
          <span className={mono ? styles.fieldValueMono : styles.fieldValue}>
            {value}
          </span>
        )
      ) : (
        <span className={styles.fieldEmpty}>—</span>
      )}
    </div>
  );
}

function DeviceCard({
  device,
  primary,
}: {
  device: DrawerAsset["devices"][number];
  primary: boolean;
}) {
  return (
    <div className={styles.deviceCard}>
      <div className={styles.deviceCardHeader}>
        <Link
          href={`/admin/dispositivos?edit=${device.id}`}
          className={`${styles.deviceImei} ${styles.fieldValueMono}`}
        >
          {device.imei}
          <ExternalLink size={11} className={styles.linkIcon} />
        </Link>
        {primary && <span className={styles.primaryBadge}>★ Principal</span>}
        <span className={styles.statusBadge}>
          {DEVICE_STATUS_LABELS[device.status] ?? device.status}
        </span>
      </div>
      <FieldRow>
        <Field
          label="Vendor"
          value={VENDOR_LABELS[device.vendor] ?? device.vendor}
        />
        <Field label="Modelo" value={device.model} />
        <Field label="Firmware" value={device.firmwareVersion} mono />
      </FieldRow>
      <Field label="Serial" value={device.serialNumber} mono />
      <Field
        label="Última conexión"
        value={device.lastSeenAt ? formatDateTime(device.lastSeenAt) : null}
      />

      <div className={styles.simBlock}>
        <div className={styles.simBlockHeader}>
          <CreditCard size={12} />
          <span className={styles.simBlockTitle}>SIM insertada</span>
        </div>
        {device.sim ? (
          <>
            <Link
              href={`/admin/sims?edit=${device.sim.id}`}
              className={`${styles.simIccid} ${styles.fieldValueMono}`}
            >
              {device.sim.iccid}
              <ExternalLink size={11} className={styles.linkIcon} />
            </Link>
            <FieldRow>
              <Field label="Carrier" value={device.sim.carrier} />
              <Field
                label="Estado"
                value={SIM_STATUS_LABELS[device.sim.status] ?? device.sim.status}
              />
              <Field label="Plan" value={`${device.sim.dataPlanMb} MB`} />
            </FieldRow>
            <FieldRow>
              <Field label="Número" value={device.sim.phoneNumber} mono />
              <Field label="APN" value={device.sim.apn} mono />
            </FieldRow>
          </>
        ) : (
          <div className={styles.emptySim}>
            Sin SIM asignada.{" "}
            <Link href="/admin/sims" className={styles.inlineLink}>
              Asignar
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${m}/${y} ${hh}:${mm}`;
}
