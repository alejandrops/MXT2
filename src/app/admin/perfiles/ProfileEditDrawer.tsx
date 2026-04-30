"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Lock } from "lucide-react";
import { updateProfile, type UpdateProfileInput } from "./actions";
import styles from "./ProfileEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  ProfileEditDrawer · matriz de permisos por perfil
//  ─────────────────────────────────────────────────────────────
//  3 niveles por módulo (radio buttons):
//    - Sin acceso       → { read: false, write: false }
//    - Lectura          → { read: true, write: false }
//    - Lectura + escritura → { read: true, write: true }
//
//  Scope (solo módulos data):
//    - "Solo su cliente" (OWN_ACCOUNT) · default
//    - "Todos los clientes" (ALL)
//
//  Si el perfil es SUPER_ADMIN · drawer en modo solo-lectura con
//  candado · no se puede modificar (perfil del sistema).
// ═══════════════════════════════════════════════════════════════

type PermLevel = "none" | "read" | "write";

interface EntityActions {
  create: boolean;
  update: boolean;
  delete: boolean;
}

interface ModulePerm {
  read: boolean;
  write: boolean;
  scope?: "ALL" | "OWN_ACCOUNT";
  // Solo para "catalogos" · sub-acciones por entidad
  vehiculos?: EntityActions;
  conductores?: EntityActions;
  grupos?: EntityActions;
}

const CATALOGOS_ENTITIES = ["vehiculos", "conductores", "grupos"] as const;
type CatalogosEntityKey = typeof CATALOGOS_ENTITIES[number];

const ENTITY_LABELS: Record<CatalogosEntityKey, string> = {
  vehiculos: "Vehículos",
  conductores: "Conductores",
  grupos: "Grupos",
};

interface ModuleGroup {
  title: string;
  modules: { key: string; label: string; hint?: string; isData: boolean }[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: "Operación",
    modules: [
      { key: "seguimiento", label: "Seguimiento", hint: "Mapa, historial, torre de control", isData: true },
      { key: "actividad", label: "Actividad", hint: "Reportes, scorecard, viajes", isData: true },
      { key: "seguridad", label: "Seguridad", hint: "Alarmas y dashboard de eventos", isData: true },
      { key: "direccion", label: "Dirección", hint: "Vista ejecutiva, boletín, distribución", isData: true },
      { key: "catalogos", label: "Catálogos", hint: "Vehículos, conductores, grupos", isData: true },
    ],
  },
  {
    title: "Personal",
    modules: [
      {
        key: "configuracion",
        label: "Configuración personal",
        hint: "Editar mi perfil, preferencias, contraseña",
        isData: false,
      },
    ],
  },
  {
    title: "Backoffice",
    modules: [
      { key: "backoffice_clientes", label: "Clientes", isData: false },
      { key: "backoffice_dispositivos", label: "Dispositivos", isData: false },
      { key: "backoffice_sims", label: "Líneas SIM", isData: false },
      { key: "backoffice_instalaciones", label: "Instalaciones", isData: false },
      { key: "backoffice_usuarios", label: "Usuarios", isData: false },
      { key: "backoffice_perfiles", label: "Perfiles", isData: false },
    ],
  },
];

const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

export interface DrawerInitialProfile {
  id: string;
  systemKey: string;
  nameLabel: string;
  userCount: number;
  permissions: unknown;
}

interface Props {
  initialProfile: DrawerInitialProfile;
}

function permLevel(p: ModulePerm | undefined): PermLevel {
  if (!p) return "none";
  if (p.write) return "write";
  if (p.read) return "read";
  return "none";
}

function levelToPerm(level: PermLevel): { read: boolean; write: boolean } {
  if (level === "write") return { read: true, write: true };
  if (level === "read") return { read: true, write: false };
  return { read: false, write: false };
}

export function ProfileEditDrawer({ initialProfile }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isSystemProfile = initialProfile.systemKey === "SUPER_ADMIN";

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  // Parsear permissions del initial · normalizar
  const incoming =
    (initialProfile.permissions as Record<string, ModulePerm>) ?? {};

  const [nameLabel, setNameLabel] = useState(initialProfile.nameLabel);
  // Estado por módulo
  const [perms, setPerms] = useState<Record<string, ModulePerm>>(() => {
    const out: Record<string, ModulePerm> = {};
    for (const groupDef of MODULE_GROUPS) {
      for (const m of groupDef.modules) {
        const p = incoming[m.key] ?? { read: false, write: false };
        if (m.isData) {
          const base: ModulePerm = {
            read: !!p.read,
            write: !!p.write,
            scope: p.scope === "ALL" ? "ALL" : "OWN_ACCOUNT",
          };
          // Solo catalogos tiene sub-entidades
          if (m.key === "catalogos") {
            for (const e of CATALOGOS_ENTITIES) {
              const incomingActions = (p as any)[e] as
                | EntityActions
                | undefined;
              base[e] = incomingActions
                ? {
                    create: !!incomingActions.create,
                    update: !!incomingActions.update,
                    delete: !!incomingActions.delete,
                  }
                : // Backwards-compat · si write=true sin sub-perms,
                  // asumimos full access
                  p.write
                  ? { create: true, update: true, delete: true }
                  : { create: false, update: false, delete: false };
            }
          }
          out[m.key] = base;
        } else {
          out[m.key] = { read: !!p.read, write: !!p.write };
        }
      }
    }
    return out;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 3500);
    return () => clearTimeout(t);
  }, [okMsg]);

  function setLevel(moduleKey: string, level: PermLevel) {
    if (isSystemProfile) return;
    setPerms((prev) => {
      const old = prev[moduleKey] ?? { read: false, write: false };
      const newPerm = levelToPerm(level);
      const next: ModulePerm = { ...newPerm, scope: old.scope };

      // Si es catalogos, ajustar sub-acciones según el level
      if (moduleKey === "catalogos") {
        const allOff: EntityActions = {
          create: false,
          update: false,
          delete: false,
        };
        const allOn: EntityActions = {
          create: true,
          update: true,
          delete: true,
        };
        if (level === "write") {
          // Al pasar a write, prendemos todas las sub-acciones por default
          // Si ya había sub-acciones definidas previamente, las preservamos
          for (const e of CATALOGOS_ENTITIES) {
            next[e] = old[e] ?? allOn;
          }
        } else {
          // Sin acceso o solo lectura · todas las sub-acciones quedan off
          for (const e of CATALOGOS_ENTITIES) {
            next[e] = allOff;
          }
        }
      }

      return { ...prev, [moduleKey]: next };
    });
  }

  function setScope(moduleKey: string, scope: "ALL" | "OWN_ACCOUNT") {
    if (isSystemProfile) return;
    setPerms((prev) => {
      const old = prev[moduleKey] ?? { read: false, write: false };
      return { ...prev, [moduleKey]: { ...old, scope } };
    });
  }

  function setEntityAction(
    moduleKey: string,
    entity: CatalogosEntityKey,
    action: keyof EntityActions,
    value: boolean,
  ) {
    if (isSystemProfile) return;
    setPerms((prev) => {
      const old = prev[moduleKey] ?? { read: false, write: false };
      const oldEntity = old[entity] ?? {
        create: false,
        update: false,
        delete: false,
      };
      return {
        ...prev,
        [moduleKey]: {
          ...old,
          [entity]: { ...oldEntity, [action]: value },
        },
      };
    });
  }

  function handleSubmit() {
    if (isSystemProfile) return;
    setErrorMsg(null);
    setOkMsg(null);

    const input: UpdateProfileInput = {
      nameLabel,
      permissions: perms as any,
    };

    startTransition(async () => {
      const result = await updateProfile(initialProfile.id, input);
      if (result.ok) {
        setOkMsg(result.message ?? "Guardado");
        router.refresh();
      } else {
        setErrorMsg(result.message ?? "Error al guardar");
      }
    });
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar perfil">
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isSystemProfile ? "Ver perfil" : "Editar perfil"}
            </span>
            <span className={styles.headerName}>{nameLabel}</span>
            <span className={styles.headerMeta}>
              {initialProfile.userCount}{" "}
              {initialProfile.userCount === 1 ? "usuario asignado" : "usuarios asignados"}
              {isSystemProfile && (
                <span className={styles.systemTag}>
                  <Lock size={11} /> Perfil del sistema
                </span>
              )}
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
          {isSystemProfile && (
            <div className={styles.sysBanner}>
              <Lock size={14} className={styles.sysBannerIcon} />
              <div>
                <strong>Perfil del sistema</strong> · sus permisos son fijos
                para evitar bloquear el acceso administrativo. No es editable
                desde esta pantalla.
              </div>
            </div>
          )}

          {/* ── Nombre del perfil ─────────────────────── */}
          <div className={styles.section}>
            <label className={styles.fieldLabel}>Nombre del perfil</label>
            <input
              type="text"
              className={styles.input}
              value={nameLabel}
              onChange={(e) => setNameLabel(e.target.value)}
              disabled={isPending || isSystemProfile}
              maxLength={60}
            />
            <span className={styles.fieldHint}>
              Etiqueta editable que se muestra en la UI · ej · &quot;Despachador&quot;,
              &quot;Supervisor de turno&quot;.
            </span>
          </div>

          {/* ── Matriz de permisos por grupo ─────────── */}
          {MODULE_GROUPS.map((group) => (
            <div key={group.title} className={styles.section}>
              <h3 className={styles.sectionTitle}>{group.title}</h3>
              <div className={styles.matrixHeader}>
                <div className={styles.matrixLabel}>Módulo</div>
                <div className={styles.matrixOption}>Sin acceso</div>
                <div className={styles.matrixOption}>Lectura</div>
                <div className={styles.matrixOption}>Escritura</div>
              </div>
              {group.modules.map((m) => {
                const p = perms[m.key] ?? { read: false, write: false };
                const level = permLevel(p);
                const showScope = m.isData && (p.read || p.write);
                const showEntityMatrix =
                  m.key === "catalogos" && level === "write";

                return (
                  <div key={m.key} className={styles.matrixRow}>
                    <div className={styles.moduleInfo}>
                      <span className={styles.moduleLabel}>{m.label}</span>
                      {m.hint && (
                        <span className={styles.moduleHint}>{m.hint}</span>
                      )}
                      {showScope && (
                        <div className={styles.scopeRow}>
                          <span className={styles.scopeLabel}>Alcance:</span>
                          <label className={styles.scopeOption}>
                            <input
                              type="radio"
                              name={`scope-${m.key}`}
                              checked={p.scope === "OWN_ACCOUNT"}
                              onChange={() => setScope(m.key, "OWN_ACCOUNT")}
                              disabled={isPending || isSystemProfile}
                            />
                            <span>Solo su cliente</span>
                          </label>
                          <label className={styles.scopeOption}>
                            <input
                              type="radio"
                              name={`scope-${m.key}`}
                              checked={p.scope === "ALL"}
                              onChange={() => setScope(m.key, "ALL")}
                              disabled={isPending || isSystemProfile}
                            />
                            <span>Todos los clientes</span>
                          </label>
                        </div>
                      )}
                      {showEntityMatrix && (
                        <div className={styles.entityMatrix}>
                          <div className={styles.entityMatrixHeader}>
                            <span className={styles.entityMatrixTitle}>
                              Por entidad:
                            </span>
                            <div className={styles.entityActions}>
                              <span className={styles.entityActionLabel}>
                                Crear
                              </span>
                              <span className={styles.entityActionLabel}>
                                Editar
                              </span>
                              <span className={styles.entityActionLabel}>
                                Eliminar
                              </span>
                            </div>
                          </div>
                          {CATALOGOS_ENTITIES.map((e) => {
                            const acts = p[e] ?? {
                              create: false,
                              update: false,
                              delete: false,
                            };
                            return (
                              <div key={e} className={styles.entityRow}>
                                <span className={styles.entityName}>
                                  {ENTITY_LABELS[e]}
                                </span>
                                <div className={styles.entityActions}>
                                  <input
                                    type="checkbox"
                                    className={styles.entityCheckbox}
                                    checked={acts.create}
                                    onChange={(ev) =>
                                      setEntityAction(
                                        m.key,
                                        e,
                                        "create",
                                        ev.target.checked,
                                      )
                                    }
                                    disabled={isPending || isSystemProfile}
                                    aria-label={`Crear ${ENTITY_LABELS[e]}`}
                                  />
                                  <input
                                    type="checkbox"
                                    className={styles.entityCheckbox}
                                    checked={acts.update}
                                    onChange={(ev) =>
                                      setEntityAction(
                                        m.key,
                                        e,
                                        "update",
                                        ev.target.checked,
                                      )
                                    }
                                    disabled={isPending || isSystemProfile}
                                    aria-label={`Editar ${ENTITY_LABELS[e]}`}
                                  />
                                  <input
                                    type="checkbox"
                                    className={styles.entityCheckbox}
                                    checked={acts.delete}
                                    onChange={(ev) =>
                                      setEntityAction(
                                        m.key,
                                        e,
                                        "delete",
                                        ev.target.checked,
                                      )
                                    }
                                    disabled={isPending || isSystemProfile}
                                    aria-label={`Eliminar ${ENTITY_LABELS[e]}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <RadioCell
                      checked={level === "none"}
                      disabled={isPending || isSystemProfile}
                      onChange={() => setLevel(m.key, "none")}
                    />
                    <RadioCell
                      checked={level === "read"}
                      disabled={isPending || isSystemProfile}
                      onChange={() => setLevel(m.key, "read")}
                    />
                    <RadioCell
                      checked={level === "write"}
                      disabled={isPending || isSystemProfile}
                      onChange={() => setLevel(m.key, "write")}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <footer className={styles.footer}>
          {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}
          {okMsg && <div className={styles.okMsg}>{okMsg}</div>}
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isPending}
            >
              {isSystemProfile ? "Cerrar" : "Cancelar"}
            </button>
            {!isSystemProfile && (
              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
}

function RadioCell({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className={styles.radioCell}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}
