"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  LoginForm (H2)
//  ─────────────────────────────────────────────────────────────
//  Email + password form. Llama a Supabase Auth desde el browser
//  · una vez que la sesión está armada, redirect al destino.
// ═══════════════════════════════════════════════════════════════

interface LoginFormProps {
  initialError: string | null;
  redirectTo: string;
}

export function LoginForm({ initialError, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      // Mensajes amigables
      if (authError.message.toLowerCase().includes("invalid")) {
        setError("Email o contraseña incorrectos.");
      } else if (authError.message.toLowerCase().includes("email not confirmed")) {
        setError("Confirmá tu email antes de ingresar.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // Refresh para que el Server Component re-renderice con sesión
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h1 className={styles.formTitle}>Iniciar sesión</h1>

      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          placeholder="tu@empresa.com"
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          Contraseña
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            placeholder="••••••••"
            disabled={loading}
          />
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? (
          <>
            <Loader2 size={16} className={styles.spin} />
            <span>Verificando…</span>
          </>
        ) : (
          <span>Ingresar</span>
        )}
      </button>

      <div className={styles.footer}>
        <a href="/auth/forgot-password" className={styles.link}>
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  );
}
