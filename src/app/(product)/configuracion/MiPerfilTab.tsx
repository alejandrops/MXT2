"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/lib/session";
import { updateMiPerfil } from "./actions";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./MiPerfilTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab "Mi perfil" · form editable
//  ─────────────────────────────────────────────────────────────
//  Inputs controlados · validación server-side · al guardar exitoso
//  hace router.refresh() para que el avatar/nombre del topbar y
//  sidebar se actualicen.
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
}

export function MiPerfilTab({ session }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState(session.user.firstName);
  const [lastName, setLastName] = useState(session.user.lastName);
  const email = session.user.email; // read-only · no setter
  const [phone, setPhone] = useState(session.user.phone ?? "");
  const [documentNumber, setDocumentNumber] = useState(
    session.user.documentNumber ?? "",
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await updateMiPerfil({
        firstName,
        lastName,
        phone,
        documentNumber,
      });
      if (result.ok) {
        setSuccessMsg(result.message ?? "Perfil actualizado");
        router.refresh();
      } else if (result.errors) {
        setErrors(result.errors);
      }
    });
  }

  const isDirty =
    firstName !== session.user.firstName ||
    lastName !== session.user.lastName ||
    phone !== (session.user.phone ?? "") ||
    documentNumber !== (session.user.documentNumber ?? "");

  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Mi perfil</h2>
        <p className={sharedStyles.tabSubtitle}>
          Datos personales · visibles para vos y para los administradores.
        </p>
      </header>

      <div className={styles.summary}>
        <div
          className={styles.bigAvatar}
          style={{ background: session.user.avatarColor }}
        >
          {session.user.initials}
        </div>
        <div className={styles.summaryInfo}>
          <span className={styles.summaryName}>
            {session.user.fullName}
          </span>
          <span className={styles.summaryEmail}>
            {session.user.email}
          </span>
          <span className={styles.summaryRole}>
            {session.profile.nameLabel}
            {session.account && (
              <>
                <span className={styles.summarySep}> · </span>
                {session.account.name}
              </>
            )}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <Field
          label="Nombre"
          required
          error={errors.firstName}
        >
          <input
            type="text"
            className={styles.input}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={isPending}
            maxLength={50}
          />
        </Field>

        <Field
          label="Apellido"
          required
          error={errors.lastName}
        >
          <input
            type="text"
            className={styles.input}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isPending}
            maxLength={50}
          />
        </Field>

        <Field
          label="Email"
          hint="No editable · para cambiarlo, contactá soporte"
          error={errors.email}
        >
          <input
            type="email"
            className={styles.input}
            value={email}
            disabled
            readOnly
            maxLength={120}
          />
        </Field>

        <Field
          label="Teléfono"
          hint="Opcional · formato libre"
          error={errors.phone}
        >
          <input
            type="tel"
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isPending}
            maxLength={30}
            placeholder="+54 11 1234-5678"
          />
        </Field>

        <Field
          label="Documento"
          hint="Opcional"
          error={errors.documentNumber}
        >
          <input
            type="text"
            className={styles.input}
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            disabled={isPending}
            maxLength={30}
          />
        </Field>

        <div className={styles.formFooter}>
          {successMsg && (
            <span className={styles.successMsg}>{successMsg}</span>
          )}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isPending || !isDirty}
          >
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Field · label + input + error
// ═══════════════════════════════════════════════════════════════

function Field({
  label,
  hint,
  required,
  error,
  children,
}: {
  label: string;
  hint?: string;
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
      {error ? (
        <span className={styles.fieldError}>{error}</span>
      ) : hint ? (
        <span className={styles.fieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}
