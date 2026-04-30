"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Building2 } from "lucide-react";
import { createClient, updateClient, type ClientInput } from "./actions";
import styles from "./ClientEditDrawer.module.css";

// ═══════════════════════════════════════════════════════════════
//  ClientEditDrawer · crear/editar Account (cliente)
//  ─────────────────────────────────────────────────────────────
//  Tier display:
//    BASE       · Plan básico · 1-50 vehículos
//    PRO        · Plan medio  · 50-500 vehículos · default
//    ENTERPRISE · Sin límites · custom features
//
//  Slug: en CREATE se auto-genera del nombre (read-only preview).
//        En EDIT es read-only (preserve URL stability).
// ═══════════════════════════════════════════════════════════════

const TIER_INFO: Record<
  "BASE" | "PRO" | "ENTERPRISE",
  { label: string; description: string }
> = {
  BASE: {
    label: "Base",
    description: "Plan básico · hasta 50 vehículos",
  },
  PRO: {
    label: "Pro",
    description: "Plan medio · 50–500 vehículos",
  },
  ENTERPRISE: {
    label: "Enterprise",
    description: "Sin límites · features custom",
  },
};

export interface DrawerInitialClient {
  id: string;
  name: string;
  slug: string;
  tier: "BASE" | "PRO" | "ENTERPRISE";
  industry: string | null;
}

interface Props {
  initialClient: DrawerInitialClient | null;
}

function previewSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function ClientEditDrawer({ initialClient }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = initialClient !== null;

  function onClose() {
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    url.searchParams.delete("edit");
    router.push(url.pathname + url.search, { scroll: false });
  }

  const [name, setName] = useState(initialClient?.name ?? "");
  const [tier, setTier] = useState<"BASE" | "PRO" | "ENTERPRISE">(
    initialClient?.tier ?? "PRO",
  );
  const [industry, setIndustry] = useState(initialClient?.industry ?? "");

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

  function buildInput(): ClientInput {
    return { name, tier, industry };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const input = buildInput();
      const result = isEdit
        ? await updateClient(initialClient!.id, input)
        : await createClient(input);

      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        if (result.errors) setErrors(result.errors);
        if (result.message && !result.errors) setGeneralError(result.message);
      }
    });
  }

  // Slug preview · solo en create
  const computedSlug = isEdit
    ? initialClient!.slug
    : previewSlug(name) || "(sin nombre)";

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label="Editar cliente">
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.headerLabel}>
              {isEdit ? "Editar cliente" : "Nuevo cliente"}
            </span>
            {isEdit && (
              <span className={styles.headerName}>{initialClient!.name}</span>
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

            <Field label="Nombre" required error={errors.name}>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                maxLength={100}
                placeholder="Ej · Carrefour Argentina"
                autoFocus={!isEdit}
              />
            </Field>

            <Field
              label="Identificador URL"
              hint={
                isEdit
                  ? "Inmutable · cambiarlo rompería links existentes"
                  : "Auto-generado del nombre · se ajusta si hay duplicado"
              }
            >
              <div className={styles.slugBox}>
                <span className={styles.slugPrefix}>maxtracker.com/<wbr/>cliente/</span>
                <span className={styles.slugValue}>{computedSlug}</span>
              </div>
            </Field>

            <Field label="Industria" error={errors.industry}>
              <input
                type="text"
                className={styles.input}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isPending}
                maxLength={60}
                placeholder="Ej · Retail · Minería · Logística · Delivery"
                list="industry-suggestions"
              />
              <datalist id="industry-suggestions">
                <option value="Retail" />
                <option value="Minería" />
                <option value="Logística" />
                <option value="Delivery / Última milla" />
                <option value="Transporte de carga" />
                <option value="Construcción" />
                <option value="Petróleo y gas" />
                <option value="Agroindustria" />
                <option value="Servicios públicos" />
              </datalist>
            </Field>
          </div>

          {/* ── Plan ─────────────────────────────────── */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Plan</h3>

            <div className={styles.tierGrid}>
              {(["BASE", "PRO", "ENTERPRISE"] as const).map((t) => {
                const info = TIER_INFO[t];
                const selected = tier === t;
                return (
                  <label
                    key={t}
                    className={`${styles.tierCard} ${selected ? styles.tierCardSelected : ""}`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value={t}
                      checked={selected}
                      onChange={() => setTier(t)}
                      disabled={isPending}
                      className={styles.tierRadio}
                    />
                    <div className={styles.tierContent}>
                      <span className={styles.tierName}>{info.label}</span>
                      <span className={styles.tierDesc}>{info.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.tier && (
              <span className={styles.fieldError}>{errors.tier}</span>
            )}
          </div>

          {!isEdit && (
            <div className={styles.section}>
              <div className={styles.infoBox}>
                <Building2 size={14} className={styles.infoIcon} />
                <div>
                  <strong>Después de crear el cliente</strong> vas a poder
                  asignarle usuarios desde <em>Usuarios</em>, importar su flota
                  desde <em>Vehículos</em> y configurar dispositivos desde{" "}
                  <em>Dispositivos</em>.
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
                : "Crear cliente"}
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
