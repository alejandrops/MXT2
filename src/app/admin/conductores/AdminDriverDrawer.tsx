"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronDown,
  ChevronRight,
  IdCard,
  Building2,
  Truck,
  TrendingUp,
  ExternalLink,
  Trash2,
  CalendarClock,
} from "lucide-react";
import Link from "next/link";
import {
  updateAdminDriver,
  deleteAdminDriver,
  type AdminDriverUpdateInput,
} from "./actions";
import styles from "./AdminDriverDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  AdminDriverDrawer (H7d) · Drawer del conductor cross-cliente
//  ─────────────────────────────────────────────────────────────
//  Editable · Identificación + Comercial + Licencia
//  Read-only · Asignaciones (vehículos que conduce) + Performance
// ═══════════════════════════════════════════════════════════════

interface DrawerDriver {
  id: string;
  firstName: string;
  lastName: string;
  document: string | null;
  licenseExpiresAt: Date | null;
  hiredAt: Date | null;
  safetyScore: number;
  account: { id: string; name: string; slug: string };
  drivenAssets: {
    id: string;
    name: string;
    plate: string | null;
    vehicleType: string;
  }[];
  stats: {
    events30d: number;
    trips30d: number;
    distance30dKm: number;
  };
}

interface Props {
  driver: DrawerDriver;
  accountOptions: { id: string; name: string }[];
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

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const y = d.getUTCFullYear();
  return `${day}/${m}/${y}`;
}

function toIsoDateInput(d: Date | null): string {
  if (!d) return "";
  // Devolvemos YYYY-MM-DD para input type="date"
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLicenseStatus(d: Date | null): {
  status: "ok" | "expiring_soon" | "expired" | "unknown";
  label: string;
  days: number | null;
} {
  if (!d) return { status: "unknown", label: "Sin registro", days: null };
  const now = Date.now();
  const days = Math.ceil((d.getTime() - now) / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return {
      status: "expired",
      label: `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`,
      days,
    };
  }
  if (days <= 30) {
    return {
      status: "expiring_soon",
      label: `Vence en ${days} ${days === 1 ? "día" : "días"}`,
      days,
    };
  }
  return { status: "ok", label: `Vigente`, days };
}

export function AdminDriverDrawer({ driver, accountOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Tipo objeto literal (no Record) · evita `string | undefined` por
  // noUncheckedIndexedAccess al acceder openSections.identification, etc.
  const [openSections, setOpenSections] = useState({
    identification: true,
    commercial: true,
    license: true,
    assignments: true,
    performance: false,
  });

  const [firstName, setFirstName] = useState(driver.firstName);
  const [lastName, setLastName] = useState(driver.lastName);
  const [documentNumber, setDocumentNumber] = useState(driver.document ?? "");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(
    toIsoDateInput(driver.licenseExpiresAt),
  );
  const [hiredAt, setHiredAt] = useState(toIsoDateInput(driver.hiredAt));
  const [accountId, setAccountId] = useState(driver.account.id);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmingDelete]);

  type SectionKey = keyof typeof openSections;
  function toggle(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key as SectionKey] }));
  }

  function buildInput(): AdminDriverUpdateInput {
    return {
      firstName,
      lastName,
      document: documentNumber,
      licenseExpiresAt,
      hiredAt,
      accountId,
    };
  }

  function handleSave() {
    setErrors({});
    setGeneralError(null);
    startTransition(async () => {
      const r = await updateAdminDriver(driver.id, buildInput());
      if (r.ok) {
        router.refresh();
        onClose();
      } else {
        if (r.errors) setErrors(r.errors);
        if (r.message && !r.errors) setGeneralError(r.message);
      }
    });
  }

  function handleDelete() {
    setGeneralError(null);
    startTransition(async () => {
      const r = await deleteAdminDriver(driver.id);
      if (r.ok) {
        router.refresh();
        onClose();
      } else {
        setConfirmingDelete(false);
        setGeneralError(r.message ?? "Error al eliminar");
      }
    });
  }

  const licenseStatus = getLicenseStatus(driver.licenseExpiresAt);
  const accountChanged = accountId !== driver.account.id;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Editar conductor"
      >
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>Editar conductor</span>
            <span className={styles.headerName}>
              {driver.firstName} {driver.lastName}
            </span>
            {driver.document && (
              <span className={styles.headerDoc}>DNI {driver.document}</span>
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

        <div className={styles.body}>
          {generalError && <div className={styles.alert}>{generalError}</div>}

          {/* ── 1. Identificación · EDITABLE ─────────────────── */}
          <Section
            icon={<IdCard size={14} />}
            title="Identificación"
            sectionKey="identification"
            open={openSections.identification}
            onToggle={toggle}
          >
            <FieldRow>
              <FormField label="Nombre" required error={errors.firstName}>
                <input
                  type="text"
                  className={styles.input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isPending}
                  maxLength={60}
                  placeholder="Juan"
                  autoFocus
                />
              </FormField>
              <FormField label="Apellido" required error={errors.lastName}>
                <input
                  type="text"
                  className={styles.input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isPending}
                  maxLength={60}
                  placeholder="Pérez"
                />
              </FormField>
            </FieldRow>
            <FormField
              label="Documento"
              error={errors.document}
              hint="DNI ARG, RUT CL, etc · 30 caracteres máx · puede repetirse entre clientes"
            >
              <input
                type="text"
                className={`${styles.input} ${styles.mono}`}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                disabled={isPending}
                maxLength={30}
                placeholder="20-12345678-3"
              />
            </FormField>
          </Section>

          {/* ── 2. Comercial · EDITABLE ──────────────────────── */}
          <Section
            icon={<Building2 size={14} />}
            title="Comercial"
            sectionKey="commercial"
            open={openSections.commercial}
            onToggle={toggle}
          >
            <FormField
              label="Cliente"
              required
              error={errors.accountId}
              hint={
                accountChanged
                  ? "⚠️ Al cambiar el cliente se liberan los vehículos asignados"
                  : undefined
              }
            >
              <select
                className={styles.input}
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
            </FormField>
            <FormField
              label="Fecha de contrato"
              error={errors.hiredAt}
              hint="Cuándo fue contratado por este cliente"
            >
              <input
                type="date"
                className={styles.input}
                value={hiredAt}
                onChange={(e) => setHiredAt(e.target.value)}
                disabled={isPending}
              />
            </FormField>
          </Section>

          {/* ── 3. Licencia · EDITABLE ───────────────────────── */}
          <Section
            icon={<CalendarClock size={14} />}
            title="Licencia de conducir"
            sectionKey="license"
            open={openSections.license}
            onToggle={toggle}
          >
            <FormField
              label="Vence el"
              error={errors.licenseExpiresAt}
              hint="Fecha de vencimiento del registro / licencia"
            >
              <input
                type="date"
                className={styles.input}
                value={licenseExpiresAt}
                onChange={(e) => setLicenseExpiresAt(e.target.value)}
                disabled={isPending}
              />
            </FormField>
            {driver.licenseExpiresAt && (
              <div
                className={`${styles.licenseChip} ${
                  licenseStatus.status === "expired"
                    ? styles.licenseExpired
                    : licenseStatus.status === "expiring_soon"
                      ? styles.licenseExpiring
                      : styles.licenseOk
                }`}
              >
                <span className={styles.licenseLabel}>
                  {licenseStatus.label}
                </span>
                <span className={styles.licenseDate}>
                  · {formatDate(driver.licenseExpiresAt)}
                </span>
              </div>
            )}
          </Section>

          {/* ── 4. Asignaciones · READ-ONLY ──────────────────── */}
          <Section
            icon={<Truck size={14} />}
            title={`Vehículos asignados (${driver.drivenAssets.length})`}
            sectionKey="assignments"
            open={openSections.assignments}
            onToggle={toggle}
          >
            {driver.drivenAssets.length === 0 ? (
              <div className={styles.placeholder}>
                <span className={styles.placeholderHint}>
                  No tiene ningún vehículo asignado actualmente.
                </span>
              </div>
            ) : (
              <div className={styles.assetList}>
                {driver.drivenAssets.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/vehiculos?edit=${a.id}`}
                    className={styles.assetCard}
                  >
                    <div className={styles.assetCardLeft}>
                      <span className={styles.assetCardName}>{a.name}</span>
                      <span className={styles.assetCardSub}>
                        {a.plate ? (
                          <span className={styles.mono}>{a.plate}</span>
                        ) : (
                          <span className={styles.assetCardEmpty}>
                            sin patente
                          </span>
                        )}
                        {" · "}
                        {VEHICLE_TYPE_LABELS[a.vehicleType] ?? a.vehicleType}
                      </span>
                    </div>
                    <ExternalLink size={12} className={styles.assetCardLink} />
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* ── 5. Performance · READ-ONLY ───────────────────── */}
          <Section
            icon={<TrendingUp size={14} />}
            title="Performance"
            sectionKey="performance"
            open={openSections.performance}
            onToggle={toggle}
          >
            <div className={styles.statsGrid}>
              <Stat
                label="Safety score"
                value={`${driver.safetyScore}/100`}
                tint={
                  driver.safetyScore >= 80
                    ? "ok"
                    : driver.safetyScore >= 60
                      ? "warn"
                      : "bad"
                }
                hint="Derivado del histórico de eventos · no editable"
              />
              <Stat
                label="Eventos · 30 días"
                value={driver.stats.events30d.toLocaleString("es-AR")}
                tint={driver.stats.events30d > 10 ? "warn" : "ok"}
              />
              <Stat
                label="Viajes · 30 días"
                value={driver.stats.trips30d.toLocaleString("es-AR")}
              />
              <Stat
                label="Km manejados · 30 días"
                value={`${driver.stats.distance30dKm.toLocaleString("es-AR")} km`}
              />
            </div>
          </Section>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setConfirmingDelete(true)}
            disabled={isPending}
          >
            <Trash2 size={13} />
            <span>Eliminar</span>
          </button>
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
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>

        {confirmingDelete && (
          <div className={styles.deleteOverlay}>
            <div className={styles.deleteDialog}>
              <h3 className={styles.deleteTitle}>
                ¿Eliminar a {driver.firstName} {driver.lastName}?
              </h3>
              <p className={styles.deleteHint}>
                Esta acción es <strong>irreversible</strong>. Los vehículos que
                tiene asignados quedarán <em>sin conductor</em>. Los viajes,
                eventos y alarmas históricas se mantienen en el sistema (con el
                conductor en blanco) para preservar la trazabilidad.
              </p>
              <div className={styles.deleteActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  {isPending ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

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

function FormField({
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

function Stat({
  label,
  value,
  hint,
  tint,
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: "ok" | "warn" | "bad";
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${
          tint === "ok"
            ? styles.statOk
            : tint === "warn"
              ? styles.statWarn
              : tint === "bad"
                ? styles.statBad
                : ""
        }`}
      >
        {value}
      </span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}
