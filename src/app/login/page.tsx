import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAuthMode } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import { LoginPicker } from "./LoginPicker";
import { loadDemoUsers } from "./loadDemoUsers";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /login
//  ─────────────────────────────────────────────────────────────
//  AUTH_MODE=demo (default)
//    · Render LoginPicker · lista de users seedeados agrupados
//      por account · click → setea cookie demo y redirect a /
//
//  AUTH_MODE=supabase (producción · futuro)
//    · LoginForm · email + password contra Supabase Auth
// ═══════════════════════════════════════════════════════════════

interface PageProps {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, redirectTo } = await searchParams;
  const authMode = getAuthMode();

  if (authMode === "demo") {
    const groups = await loadDemoUsers();
    return (
      <div className={styles.page}>
        <div className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.brandSection}>
            <div className={styles.logo}>Maxtracker</div>
            <div className={styles.tagline}>Telemática Enterprise</div>
          </div>
          <LoginPicker groups={groups} />
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
