"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, KeyRound, Copy, Check } from "lucide-react";
import { createUser, updateUser, type UserInput } from "./actions";
import styles from "./UserEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  UserEditDrawer · drawer para crear/editar usuarios del backoffice
//  ─────────────────────────────────────────────────────────────
//  Modo create:
//    · El admin elige perfil → si SA/MA, accountId queda vacío
//                           → si CA/OP, accountId obligatorio
//    · Al crear, mostramos la contraseña inicial (demo123) en
//      un banner verde · el admin debe copiarla
//
//  Modo edit:
//    · Solo se editan datos personales
//    · Perfil y cliente NO se cambian (el campo aparece read-only
//      con explicación). Para cambiar perfil → desactivar +
//      crear nuevo usuario.
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROFILE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  MAXTRACKER_ADMIN: "Admin Maxtracker",
  CLIENT_ADMIN: "Admin de cliente",
  OPERATOR: "Operador",
};

export interface DrawerInitialUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED";
  accountId: string | null;
  accountName: string | null;
  profileId: string;
  profileSystemKey: string;
  profileLabel: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface ProfileOption {
  id: string;
  systemKey: string;
  nameLabel: string;
}

interface Props {
  initialUser: DrawerInitialUser | null;
  accountOptions: AccountOption[];
  profileOptions: ProfileOption[];
  /** systemKey del actor · usado para filtrar perfiles asignables */
  actorProfileKey: string;
  /** accountId del actor · CLIENT_ADMIN solo crea OP de su account */
  actorAccountId: string | null;
}

export function UserEditDrawer({
  initialUser,
  accountOptions,
  profileOptions,
  actorProfileKey,
  actorAccountId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialUser !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  // Filtrar perfiles asignables según el actor
  const assignableProfiles = profileOptions.filter((p) => {
    if (actorProfileKey === "SUPER_ADMIN") return true;
    if (actorProfileKey === "MAXTRACKER_ADMIN")
      return p.systemKey !== "SUPER_ADMIN";
    if (actorProfileKey === "CLIENT_ADMIN") return p.systemKey === "OPERATOR";
    return false;
  });

  // Default profile: si hay 1 solo asignable, usarlo · si no, vacío
  const defaultProfileId = isEdit
    ? initialUser!.profileId
    : assignableProfiles.length === 1
      ? assignableProfiles[0].id
      : "";

  // Default accountId: en create con CA, forzar el del actor
  const defaultAccountId =
    isEdit
      ? initialUser?.accountId ?? null
      : actorProfileKey === "CLIENT_ADMIN"
        ? actorAccountId
        : null;

  const [profileId, setProfileId] = useState(defaultProfileId);
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);
  const [firstName, setFirstName] = useState(initialUser?.firstName ?? "");
  const [lastName, setLastName] = useState(initialUser?.lastName ?? "");
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [documentNumber, setDocumentNumber] = useState(
    initialUser?.documentNumber ?? "",
  );
  const [phone, setPhone] = useState(initialUser?.phone ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // El profile elegido determina si necesita accountId
  const selectedProfile = profileOptions.find((p) => p.id === profileId);
  const profileNeedsAccount =
    selectedProfile?.systemKey === "CLIENT_ADMIN" ||
    selectedProfile?.systemKey === "OPERATOR";

  // Si cambió el profile a uno cross-account, limpiar accountId
  useEffect(() => {
    if (selectedProfile && !profileNeedsAccount) {
      setAccountId(null);
    } else if (
      selectedProfile &&
      profileNeedsAccount &&
      actorProfileKey === "CLIENT_ADMIN"
    ) {
      setAccountId(actorAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildInput(): UserInput {
    return {
      accountId,
      profileId,
      firstName,
      lastName,
      email,
      documentNumber,
      phone,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateUser(initialUser!.id, input)
        : await createUser(input);

      if (result.ok) {
        if (!isEdit && result.initialPassword) {
          // Mostrar password en banner antes de cerrar
          setCreatedPassword(result.initialPassword);
          setCreatedEmail(input.email);
          // No cerramos el drawer · el admin debe copiar la pass
          router.refresh();
          return;
        }
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setGeneralError(result.message);
      }
    });
  }

  async function handleCopy() {
    if (!createdPassword || !createdEmail) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${createdEmail}\nContraseña: ${createdPassword}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore · clipboard puede fallar en algunos contextos
    }
  }

  // Banner de éxito post-create
  if (createdPassword && createdEmail) {
    return (
      <>
        <div className={styles.overlay} onClick={onClose} />
        <aside className={styles.drawer} role="dialog">
          <header className={styles.header}>
            <div className={styles.headerInfo}>
              <span className={styles.headerLabel}>Usuario creado</span>
              <span className={styles.headerName}>
                {firstName} {lastName}
              </span>
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
            <div className={styles.successBanner}>
              <KeyRound size={18} className={styles.bannerIcon} />
              <div className={styles.bannerContent}>
                <strong className={styles.bannerTitle}>
                  Credenciales iniciales
                </strong>
                <p className={styles.bannerHint}>
                  Compartilas con el usuario por un canal seguro. Va a poder
                  cambiarlas desde su Configuración.
                </p>
                <div className={styles.credBox}>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Email</span>
                    <span className={styles.credValue}>{createdEmail}</span>
                  </div>
                  <div className={styles.credRow}>
                    <span className={styles.credLabel}>Contraseña</span>
                    <span className={`${styles.credValue} ${styles.mono}`}>
                      {createdPassword}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check size={13} /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> Copiar credenciales
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={onClose}
            >
              Listo
            </button>
          </footer>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar usuario">
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar usuario" : "Nuevo usuario"}
            </span>
            {isEdit && (
              <span className={styles.headerName}>
                {initialUser!.firstName} {initialUser!.lastName}
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

          {/* Sección perfil + cliente */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Acceso</h3>

            {isEdit ? (
              <Field label="Perfil" hint="No editable · para cambiar perfil, desactivá este usuario y creá uno nuevo.">
                <div className={styles.readOnlyValue}>
                  {SYSTEM_PROFILE_LABELS[initialUser!.profileSystemKey] ??
                    initialUser!.profileLabel}
                </div>
              </Field>
            ) : (
              <Field label="Perfil" required error={errors.profileId}>
                <select
                  className={styles.select}
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">— Elegí un perfil —</option>
                  {assignableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {SYSTEM_PROFILE_LABELS[p.systemKey] ?? p.nameLabel}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {isEdit ? (
              <Field label="Cliente">
                <div className={styles.readOnlyValue}>
                  {initialUser!.accountName ?? (
                    <span className={styles.dim}>
                      Sin cliente (acceso cross-account)
                    </span>
                  )}
                </div>
              </Field>
            ) : profileNeedsAccount ? (
              <Field label="Cliente" required error={errors.accountId}>
                {actorProfileKey === "CLIENT_ADMIN" ? (
                  <div className={styles.readOnlyValue}>
                    {accountOptions.find((a) => a.id === accountId)?.name ??
                      "(tu cliente)"}
                  </div>
                ) : (
                  <select
                    className={styles.select}
                    value={accountId ?? ""}
                    onChange={(e) =>
                      setAccountId(e.target.value === "" ? null : e.target.value)
                    }
                    disabled={isPending}
                  >
                    <option value="">— Elegí un cliente —</option>
                    {accountOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ) : selectedProfile ? (
              <Field
                label="Cliente"
                hint={`${SYSTEM_PROFILE_LABELS[selectedProfile.systemKey]} no se asigna a ningún cliente · acceso cross-account.`}
              >
                <div className={styles.readOnlyValue}>
                  <span className={styles.dim}>—</span>
                </div>
              </Field>
            ) : null}
          </div>

          {/* Sección personal */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Datos personales</h3>

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

            <Field label="Email" required error={errors.email}>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                maxLength={120}
                placeholder="usuario@empresa.com"
              />
            </Field>

            <div className={styles.row2}>
              <Field label="Documento" error={errors.documentNumber}>
                <input
                  type="text"
                  className={styles.input}
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={isPending}
                  maxLength={30}
                />
              </Field>
              <Field label="Teléfono" error={errors.phone}>
                <input
                  type="tel"
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  maxLength={30}
                />
              </Field>
            </div>
          </div>

          {!isEdit && (
            <div className={styles.section}>
              <div className={styles.passInfoBox}>
                <KeyRound size={14} className={styles.passInfoIcon} />
                <div>
                  <strong>Contraseña inicial</strong> · al crear el usuario,
                  asignamos automáticamente la contraseña{" "}
                  <code className={styles.mono}>demo123</code>. La vamos a
                  mostrar en pantalla para que se la compartas.
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
                : "Crear usuario"}
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
