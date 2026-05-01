"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { updateEmpresaDatos } from "../actions-empresa";
import sharedStyles from "../ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab Empresa · Datos de la cuenta (S1)
//  ─────────────────────────────────────────────────────────────
//  Edita los datos básicos del Account: nombre comercial, industria,
//  contactos para alertas. Slug NO se edita (es identidad técnica).
//  Tier NO se edita acá (es decisión comercial · va en Plan).
// ═══════════════════════════════════════════════════════════════

interface AccountWithSettings {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  tier: string;
  settings: {
    alertContactEmail: string | null;
    alertContactPhone: string | null;
  } | null;
}

interface Props {
  account: AccountWithSettings;
}

const INDUSTRY_OPTIONS = [
  "Logística",
  "Minería",
  "Delivery",
  "Transporte de carga",
  "Transporte de pasajeros",
  "Construcción",
  "Agricultura",
  "Servicios públicos",
  "Otros",
];

export function EmpresaDatosTab({ account }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const [name, setName] = useState(account.name);
  const [industry, setIndustry] = useState(account.industry ?? "");
  const [alertEmail, setAlertEmail] = useState(
    account.settings?.alertContactEmail ?? "",
  );
  const [alertPhone, setAlertPhone] = useState(
    account.settings?.alertContactPhone ?? "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await updateEmpresaDatos({
        accountId: account.id,
        name: name.trim(),
        industry: industry.trim() || null,
        alertContactEmail: alertEmail.trim() || null,
        alertContactPhone: alertPhone.trim() || null,
      });

      if (result.ok) {
        setFeedback({ kind: "success", text: "Datos actualizados." });
        router.refresh();
      } else {
        setFeedback({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Datos de la cuenta</h2>
        <p className={sharedStyles.tabSubtitle}>
          Información general de tu organización en Maxtracker.
        </p>
      </header>

      <div className={sharedStyles.section}>
        <div className={sharedStyles.field}>
          <label htmlFor="name" className={sharedStyles.label}>
            Nombre comercial
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={sharedStyles.input}
            required
            disabled={pending}
          />
        </div>

        <div className={sharedStyles.fieldRow}>
          <div className={sharedStyles.field}>
            <label htmlFor="slug" className={sharedStyles.label}>
              Slug (identificador técnico)
            </label>
            <input
              id="slug"
              type="text"
              value={account.slug}
              className={sharedStyles.input}
              disabled
            />
            <span className={sharedStyles.helpText}>
              No editable. Para cambios contactá a soporte.
            </span>
          </div>

          <div className={sharedStyles.field}>
            <label htmlFor="industry" className={sharedStyles.label}>
              Industria
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className={sharedStyles.select}
              disabled={pending}
            >
              <option value="">Sin especificar</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={sharedStyles.section}>
        <h3 className={sharedStyles.sectionTitle}>Contacto para alertas</h3>
        <p className={sharedStyles.sectionDescription}>
          Datos a los que llegan las notificaciones críticas a nivel
          organización (alarmas de severidad alta, cortes de servicio).
        </p>

        <div className={sharedStyles.fieldRow}>
          <div className={sharedStyles.field}>
            <label htmlFor="alertEmail" className={sharedStyles.label}>
              Email de alertas
            </label>
            <input
              id="alertEmail"
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className={sharedStyles.input}
              placeholder="alertas@tuempresa.com"
              disabled={pending}
            />
          </div>

          <div className={sharedStyles.field}>
            <label htmlFor="alertPhone" className={sharedStyles.label}>
              Teléfono de alertas
            </label>
            <input
              id="alertPhone"
              type="tel"
              value={alertPhone}
              onChange={(e) => setAlertPhone(e.target.value)}
              className={sharedStyles.input}
              placeholder="+54 11 5555-5555"
              disabled={pending}
            />
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.kind === "success"
              ? sharedStyles.successMessage
              : sharedStyles.errorMessage
          }
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className={sharedStyles.actionsRow}>
        <button
          type="submit"
          className={sharedStyles.btnPrimary}
          disabled={pending}
        >
          {pending && <Loader2 size={14} className={sharedStyles.spin} />}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
