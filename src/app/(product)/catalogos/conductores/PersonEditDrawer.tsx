"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createPerson, updatePerson, type PersonInput } from "./actions";
import styles from "./PersonEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  PersonEditDrawer · drawer para crear/editar conductores
//  ─────────────────────────────────────────────────────────────
//  Campos editables:
//    · Cliente (solo create + solo si SA/MA)
//    · Nombre, Apellido (requeridos)
//    · Documento (opcional)
//    · Fecha de ingreso (opcional)
//    · Vencimiento de licencia (opcional)
//    · Score de seguridad · READ-ONLY (derivado de eventos)
// ═══════════════════════════════════════════════════════════════

export interface DrawerInitialPerson {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  document: string | null;
  hiredAt: Date | null;
  licenseExpiresAt: Date | null;
  safetyScore: number;
}

export interface AccountOption {
  id: string;
  name: string;
}

interface Props {
  initialPerson: DrawerInitialPerson | null;
  accountOptions: AccountOption[];
}

function dateToInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function PersonEditDrawer({ initialPerson, accountOptions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialPerson !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  const defaultAccountId = isEdit
    ? initialPerson!.accountId
    : accountOptions[0]?.id ?? "";

  const [accountId, setAccountId] = useState(defaultAccountId);
  const [firstName, setFirstName] = useState(initialPerson?.firstName ?? "");
  const [lastName, setLastName] = useState(initialPerson?.lastName ?? "");
  const [documentNumber, setDocumentNumber] = useState(
    initialPerson?.document ?? "",
  );
  const [hiredAt, setHiredAt] = useState(dateToInput(initialPerson?.hiredAt ?? null));
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(
    dateToInput(initialPerson?.licenseExpiresAt ?? null),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildInput(): PersonInput {
    return {
      accountId,
      firstName,
      lastName,
      document: documentNumber,
      hiredAt,
      licenseExpiresAt,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updatePerson(initialPerson!.id, input)
        : await createPerson(input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setGeneralError(result.message);
      }
    });
  }

  const showAccountSelect = !isEdit && accountOptions.length > 1;

  // Initials para avatar visual
  const initials = `${(firstName[0] ?? "?").toUpperCase()}${(lastName[0] ?? "").toUpperCase()}`;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar conductor">
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar conductor" : "Nuevo conductor"}
            </span>
            {isEdit && (
              <span className={styles.headerName}>
                {initialPerson!.firstName} {initialPerson!.lastName}
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

          {/* Avatar preview · solo en edit + score */}
          {isEdit && (
            <div className={styles.avatarRow}>
              <span className={styles.avatar}>{initials}</span>
              <div className={styles.avatarMeta}>
                <span className={styles.avatarName}>
                  {firstName} {lastName}
                </span>
                <span className={styles.avatarScore}>
                  Score de seguridad ·{" "}
                  <strong
                    className={
                      initialPerson!.safetyScore >= 80
                        ? styles.scoreGrn
                        : initialPerson!.safetyScore >= 60
                          ? styles.scoreAmb
                          : styles.scoreRed
                    }
                  >
                    {initialPerson!.safetyScore}
                  </strong>
                  <span className={styles.scoreHint}>
                    {" "}· se actualiza automáticamente desde eventos
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className={styles.section}>
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

            <div className={styles.row2}>
              <Field label="Nombre" required error={errors.firstName}>
                <input
                  type="text"
                  className={styles.input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isPending}
                  maxLength={50}
                />
              </Field>
              <Field label="Apellido" required error={errors.lastName}>
                <input
                  type="text"
                  className={styles.input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isPending}
                  maxLength={50}
                />
              </Field>
            </div>

            <Field label="Documento" error={errors.document}>
              <input
                type="text"
                className={styles.input}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                disabled={isPending}
                maxLength={30}
                placeholder="DNI o equivalente"
              />
            </Field>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Empleo y licencia</h3>

            <div className={styles.row2}>
              <Field label="Fecha de ingreso" error={errors.hiredAt}>
                <input
                  type="date"
                  className={styles.input}
                  value={hiredAt}
                  onChange={(e) => setHiredAt(e.target.value)}
                  disabled={isPending}
                />
              </Field>
              <Field
                label="Vencimiento de licencia"
                error={errors.licenseExpiresAt}
              >
                <input
                  type="date"
                  className={styles.input}
                  value={licenseExpiresAt}
                  onChange={(e) => setLicenseExpiresAt(e.target.value)}
                  disabled={isPending}
                />
              </Field>
            </div>
          </div>
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
                : "Crear conductor"}
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
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}> *</span>}
      </label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}
