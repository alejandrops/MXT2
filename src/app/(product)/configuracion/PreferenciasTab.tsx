"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionData } from "@/lib/session";
import { updatePreferencias } from "./actions";
import sharedStyles from "./ConfiguracionPage.module.css";
import styles from "./PreferenciasTab.module.css";

// ═══════════════════════════════════════════════════════════════
//  Tab "Preferencias" · idioma + tema
//  ─────────────────────────────────────────────────────────────
//  Idioma · solo español por ahora · selector persiste pero no
//  cambia la UI (post-MVP cuando se complete i18n).
//
//  Tema · LIGHT / DARK / AUTO · funcional desde S2. Al guardar,
//  el layout re-renderea con el nuevo session, ThemeProvider
//  recibe el nuevo pref y aplica data-theme al <html>.
// ═══════════════════════════════════════════════════════════════

interface Props {
  session: SessionData;
}

const LANGUAGES: { code: string; label: string }[] = [
  { code: "es-AR", label: "Español (Argentina)" },
  { code: "es-MX", label: "Español (México)" },
  { code: "en-US", label: "English (US)" },
];

const THEMES: { code: "LIGHT" | "DARK" | "AUTO"; label: string; hint: string }[] = [
  { code: "LIGHT", label: "Claro", hint: "Fondo claro · ideal para uso diurno" },
  { code: "DARK", label: "Oscuro", hint: "Fondo oscuro · ideal para uso nocturno" },
  { code: "AUTO", label: "Automático", hint: "Sigue la preferencia del sistema" },
];

export function PreferenciasTab({ session }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [language, setLanguage] = useState(session.user.language);
  const [theme, setTheme] = useState(session.user.theme);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isDirty =
    language !== session.user.language || theme !== session.user.theme;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await updatePreferencias({ language, theme });
      if (result.ok) {
        setSuccessMsg(result.message ?? "Preferencias actualizadas");
        router.refresh();
      }
    });
  }

  return (
    <div className={styles.container}>
      <header className={sharedStyles.tabHeader}>
        <h2 className={sharedStyles.tabTitle}>Preferencias</h2>
        <p className={sharedStyles.tabSubtitle}>
          Cómo querés ver y usar la plataforma.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        {/* ── Idioma ──────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Idioma</h3>
          <p className={styles.sectionHint}>
            Idioma de la interfaz · esta versión está disponible solo en
            español. Otros idiomas próximamente.
          </p>
          <select
            className={styles.select}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isPending}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </section>

        {/* ── Tema ────────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tema</h3>
          <p className={styles.sectionHint}>
            En esta versión el modo oscuro aplica únicamente a Modo
            Administrador · próximamente disponible para toda la plataforma.
          </p>
          <div className={styles.radioGroup}>
            {THEMES.map((t) => (
              <label key={t.code} className={styles.radioCard}>
                <input
                  type="radio"
                  name="theme"
                  value={t.code}
                  checked={theme === t.code}
                  onChange={() => setTheme(t.code)}
                  disabled={isPending}
                  className={styles.radioInput}
                />
                <div className={styles.radioBody}>
                  <span className={styles.radioLabel}>{t.label}</span>
                  <span className={styles.radioHint}>{t.hint}</span>
                </div>
              </label>
            ))}
          </div>
        </section>

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
