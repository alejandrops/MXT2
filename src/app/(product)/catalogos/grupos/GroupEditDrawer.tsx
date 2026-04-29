"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createGroup, updateGroup, type GroupInput } from "./actions";
import styles from "./GroupEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  GroupEditDrawer · drawer para crear/editar grupos
//  ─────────────────────────────────────────────────────────────
//  Particularidad · selectbox de "Padre". Las opciones se filtran
//  cliente-side por accountId · NO incluyen al grupo actual ni
//  sus descendientes (eso lo computa el server al armar
//  parentOptions).
// ═══════════════════════════════════════════════════════════════

export interface DrawerInitialGroup {
  id: string;
  accountId: string;
  parentId: string | null;
  name: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface ParentOption {
  id: string;
  name: string;
  accountId: string;
  parentName: string | null;
}

interface Props {
  initialGroup: DrawerInitialGroup | null;
  accountOptions: AccountOption[];
  /** Pre-cargado server-side · si edit, ya excluye el grupo actual + descendientes */
  parentOptions: ParentOption[];
}

export function GroupEditDrawer({
  initialGroup,
  accountOptions,
  parentOptions,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialGroup !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  const defaultAccountId = isEdit
    ? initialGroup!.accountId
    : accountOptions[0]?.id ?? "";

  const [accountId, setAccountId] = useState(defaultAccountId);
  const [name, setName] = useState(initialGroup?.name ?? "");
  const [parentId, setParentId] = useState(initialGroup?.parentId ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Filtrar parents por accountId actual
  const filteredParents = parentOptions.filter(
    (p) => p.accountId === accountId,
  );

  // Si cambia accountId y el parentId actual no pertenece al nuevo
  // account, resetear
  useEffect(() => {
    if (parentId && !filteredParents.some((p) => p.id === parentId)) {
      setParentId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildInput(): GroupInput {
    return {
      accountId,
      name,
      parentId: parentId || null,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateGroup(initialGroup!.id, input)
        : await createGroup(input);

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

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar grupo">
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar grupo" : "Nuevo grupo"}
            </span>
            {isEdit && (
              <span className={styles.headerName}>{initialGroup!.name}</span>
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

            <Field label="Nombre" required error={errors.name}>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                maxLength={80}
                placeholder="Ej · Norte, Distribución CABA, Cantera A"
              />
            </Field>

            <Field
              label="Grupo padre"
              error={errors.parentId}
              hint="Opcional · permite armar jerarquía multi-nivel."
            >
              <select
                className={styles.select}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={isPending}
              >
                <option value="">— Sin padre (grupo raíz) —</option>
                {filteredParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.parentName ? `${p.parentName} · ${p.name}` : p.name}
                  </option>
                ))}
              </select>
              {isEdit && filteredParents.length === 0 && (
                <span className={styles.fieldHint}>
                  No hay otros grupos compatibles para ser padre · este es el
                  único o todos sus posibles padres son sus descendientes.
                </span>
              )}
            </Field>
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
                : "Crear grupo"}
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
