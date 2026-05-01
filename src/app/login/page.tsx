import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAuthMode } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /login (H2)
//  ─────────────────────────────────────────────────────────────
//  Pantalla pública de login con email + password.
//
//  Si el user ya tiene sesión activa → redirect a /
//  Si AUTH_MODE=demo → mostrar un cartel y link a /
//    (no tiene sentido el login form en modo demo)
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, redirectTo } = await searchParams;
  const authMode = getAuthMode();

  if (authMode === "demo") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.brandSection}>
            <div className={styles.logo}>Maxtracker</div>
            <div className={styles.tagline}>Telemática Enterprise</div>
          </div>
          <div className={styles.demoNotice}>
            <strong>Modo demo activo</strong>
            <p>
              El login real no aplica en desarrollo local. La sesión se
              maneja con cookie demo · usá el switcher de identidad del
              topbar para cambiar de usuario.
            </p>
            <a href="/" className={styles.linkBtn}>
              Ir al producto →
            </a>
          </div>
        </div>
      </div>
    );
  }

  // En modo Supabase, si ya hay sesión, redirect
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(redirectTo ?? "/");
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandSection}>
          <div className={styles.logo}>Maxtracker</div>
          <div className={styles.tagline}>Telemática Enterprise</div>
        </div>
        <LoginForm
          initialError={mapErrorCode(error)}
          redirectTo={redirectTo ?? "/"}
        />
      </div>
    </div>
  );
}

function mapErrorCode(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "user_not_provisioned":
      return "Tu cuenta existe en autenticación pero no en Maxtracker. Contactá al administrador.";
    case "callback_failed":
      return "Hubo un problema al completar el login. Reintentá.";
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    default:
      return "Ocurrió un error inesperado al iniciar sesión.";
  }
}
