import { getSession } from "@/lib/session";
import { ConfiguracionClient } from "./ConfiguracionClient";
import styles from "./ConfiguracionPage.module.css";

// ═══════════════════════════════════════════════════════════════
//  /configuracion · Configuración personal
//  ─────────────────────────────────────────────────────────────
//  Lote A1 · 2 tabs activos (Mi perfil, Preferencias)
//  Lote A2 · agrega Notificaciones, Seguridad, Mi cuenta
//
//  Tabs accesibles vía ?tab=perfil|preferencias|... Linkable y
//  shareable. Default = perfil.
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export type TabKey =
  | "perfil"
  | "notificaciones"
  | "preferencias"
  | "seguridad"
  | "cuenta";

const VALID_TABS: TabKey[] = [
  "perfil",
  "notificaciones",
  "preferencias",
  "seguridad",
  "cuenta",
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tabRaw = sp.tab;
  const tabParam = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const activeTab: TabKey = VALID_TABS.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : "perfil";

  const session = await getSession();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>Mi cuenta y preferencias</p>
      </header>

      <ConfiguracionClient session={session} activeTab={activeTab} />
    </div>
  );
}
