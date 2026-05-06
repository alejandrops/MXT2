"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Info,
} from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/maxtracker/ui/DataTable";
import { UserDetailPanel } from "@/components/maxtracker/users/UserDetailPanel";
import { createAccountUser } from "../actions-empresa";
import sharedStyles from "../ConfiguracionPage.module.css";
import styles from "./EmpresaUsuariosTab.module.css";
import { SetPasswordModal } from "./SetPasswordModal";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Usuarios y permisos · S5-T1b · canónico
//  ─────────────────────────────────────────────────────────────
//  Reescritura del tab usando DataTable v2 + side panel canónico.
//
//  ANTES                              AHORA
//  ──────────────────────────────     ─────────────────────────
//  <table> custom HTML                DataTable v2
//  UserRow con state inline           Click → side panel canónico
//  Edit perfil inline en celda        Edit perfil dentro del side
//  Acciones en columna "Acciones"     panel · botones de acción
//  Sin export                         Menú export CSV/XLSX/PDF
//
//  Las funciones server (createAccountUser · updateAccountUser ·
//  toggleUserStatus · deleteAccountUser) NO cambiaron.
//
//  Reglas de permisos (preservadas):
//   · No te podés borrar a vos mismo
//   · No podés cambiar tu propio perfil (evitar lock-out)
// ═══════════════════════════════════════════════════════════════

interface AccountUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  profileId: string;
  profile: {
    id: string;
    systemKey: string;
    nameLabel: string;
  };
}

interface AssignableProfile {
  id: string;
  systemKey: string;
  nameLabel: string;
}

interface Props {
  account: { id: string; name: string };
  users: AccountUser[];
  assignableProfiles: AssignableProfile[];
  currentUserId: string;
}

export function EmpresaUsuariosTab({
  account,
  users,
  assignableProfiles,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [setPassUser, setSetPassUser] = useState<AccountUser | null>(null);
  const [selectedUser, setSelectedUser] = useState<AccountUser | null>(null);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  // Auto-clear feedback a los 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  function showFeedback(kind: "success" | "error", text: string) {
    setFeedback({ kind, text });
  }

  // ── Columnas del DataTable ────────────────────────────────
  const columns: ColumnDef<AccountUser>[] = [
    {
      key: "name",
      label: "Nombre",
      sortable: false,
      render: (u) => (
        <span>
          <strong>
            {u.firstName} {u.lastName}
          </strong>
          {u.id === currentUserId && (
            <span className={styles.youBadge}> · Vos</span>
          )}
        </span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: false,
      render: (u) => <span className={styles.emailCell}>{u.email}</span>,
    },
    {
      key: "profile",
      label: "Perfil",
      sortable: false,
      render: (u) => (
        <span className={styles.profileCell}>{u.profile.nameLabel}</span>
      ),
    },
    {
      key: "status",
      label: "Estado",
      sortable: false,
      render: (u) => {
        const isActive = u.status === "ACTIVE";
        const label =
          u.status === "ACTIVE"
            ? "Activo"
            : u.status === "SUSPENDED"
              ? "Suspendido"
              : u.status;
        return (
          <span
            className={`${sharedStyles.statusBadge} ${
              isActive
                ? sharedStyles.statusBadgeActive
                : sharedStyles.statusBadgeSuspended
            }`}
          >
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Usuarios y permisos</h2>
        <p className={sharedStyles.tabSubtitle}>
          Gestioná los usuarios que acceden a {account.name}.
        </p>
      </header>

      {feedback && (
        <div
          className={
            feedback.kind === "success"
              ? sharedStyles.successMessage
              : sharedStyles.errorMessage
          }
          style={{ marginBottom: 16 }}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <DataTable<AccountUser>
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        title="Usuarios"
        count={users.length}
        density="normal"
        onRowClick={(u) => setSelectedUser(u)}
        selectedRowKey={selectedUser?.id ?? null}
        exportFilename={`usuarios-${account.name.toLowerCase().replace(/\s+/g, "-")}`}
        exportColumns={[
          { header: "Nombre", value: (u) => u.firstName },
          { header: "Apellido", value: (u) => u.lastName },
          { header: "Email", value: (u) => u.email },
          { header: "Perfil", value: (u) => u.profile.nameLabel },
          { header: "Estado", value: (u) => u.status },
        ]}
        headerActions={
          <button
            type="button"
            className={sharedStyles.btnPrimary}
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} />
            Nuevo usuario
          </button>
        }
        emptyMessage="Aún no hay usuarios en esta cuenta."
      />

      <UserDetailPanel
        user={selectedUser}
        isCurrentUser={selectedUser?.id === currentUserId}
        assignableProfiles={assignableProfiles}
        onClose={() => setSelectedUser(null)}
        onChange={() => router.refresh()}
        onFeedback={showFeedback}
        onSetPass={() => {
          if (selectedUser) setSetPassUser(selectedUser);
        }}
      />

      {showCreate && (
        <CreateUserModal
          accountId={account.id}
          assignableProfiles={assignableProfiles}
          onClose={() => setShowCreate(false)}
          onSuccess={(message) => {
            setShowCreate(false);
            showFeedback("success", message);
            router.refresh();
          }}
        />
      )}

      {setPassUser && (
        <SetPasswordModal
          user={setPassUser}
          onClose={() => setSetPassUser(null)}
          onSuccess={(message) => {
            showFeedback("success", message);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Create user modal · sin cambios respecto al original
// ═══════════════════════════════════════════════════════════════

interface CreateUserModalProps {
  accountId: string;
  assignableProfiles: AssignableProfile[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

function CreateUserModal({
  accountId,
  assignableProfiles,
  onClose,
  onSuccess,
}: CreateUserModalProps) {
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState(
    assignableProfiles.find((p) => p.systemKey === "OPERATOR")?.id ??
      assignableProfiles[0]?.id ??
      "",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAccountUser({
        accountId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        profileId,
      });

      if (result.ok) {
        onSuccess(`Usuario ${firstName} ${lastName} creado.`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Nuevo usuario</h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={sharedStyles.fieldRow}>
            <div className={sharedStyles.field}>
              <label className={sharedStyles.label}>Nombre</label>
              <input
                type="text"
                required
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={sharedStyles.input}
                disabled={pending}
              />
            </div>
            <div className={sharedStyles.field}>
              <label className={sharedStyles.label}>Apellido</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={sharedStyles.input}
                disabled={pending}
              />
            </div>
          </div>

          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={sharedStyles.input}
              placeholder="usuario@empresa.com"
              disabled={pending}
            />
          </div>

          <div className={styles.infoBox}>
            <Info size={14} />
            <div>
              <strong>Importante · invite manual</strong>
              <p>
                Este formulario solo crea el usuario en la base de datos. Para
                que pueda iniciar sesión, también hay que crearle la cuenta en
                Supabase Auth con el mismo email. Tu administrador de Maxtracker
                (Alejandro) lo gestiona.
              </p>
            </div>
          </div>

          <div className={sharedStyles.field}>
            <label className={sharedStyles.label}>Perfil</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={sharedStyles.select}
              disabled={pending}
            >
              {assignableProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameLabel}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className={sharedStyles.errorMessage}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={sharedStyles.btnSecondary}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={sharedStyles.btnPrimary}
              disabled={pending || !firstName || !lastName || !email}
            >
              {pending && <Loader2 size={14} className={sharedStyles.spin} />}
              Crear usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
