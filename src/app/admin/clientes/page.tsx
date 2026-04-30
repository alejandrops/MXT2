import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import {
  getClientCounts,
  getClientForEdit,
  listClients,
  type ClientRow,
} from "@/lib/queries";
import { getSession } from "@/lib/session";
import { canRead, canWrite } from "@/lib/permissions";
import { ClientEditDrawer } from "./ClientEditDrawer";
import { ClientActionsKebab } from "./ClientActionsKebab";
import { NewClientButton } from "./NewClientButton";
import styles from "./page.module.css";

// ═══════════════════════════════════════════════════════════════
//  /admin/clientes · Backoffice multi-tenant management (H1)
//  ─────────────────────────────────────────────────────────────
//  CRUD completo de Accounts · Maxtracker staff puede crear,
//  editar y eliminar clientes (con check de FK).
//
//  Permisos:
//    SA → read + write
//    MA → read + write
//    CA, OP → redirect a /admin
// ═══════════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tier?: string;
    new?: string;
    edit?: string | string[];
  }>;
}

const ALLOWED_TIERS: ClientRow["tier"][] = ["BASE", "PRO", "ENTERPRISE"];

export default async function ClientesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : null;
  const tier =
    typeof sp.tier === "string" &&
    ALLOWED_TIERS.includes(sp.tier as ClientRow["tier"])
      ? (sp.tier as ClientRow["tier"])
      : null;

  // Drawer
  const isNew = sp.new === "1";
  const editIdRaw = sp.edit;
  const editId = Array.isArray(editIdRaw) ? editIdRaw[0] : editIdRaw;
  const drawerMode: "new" | "edit" | "closed" = editId
    ? "edit"
    : isNew
      ? "new"
      : "closed";

  // Permisos
  const session = await getSession();
  if (!canRead(session, "backoffice_clientes")) {
    redirect("/admin");
  }
  const userCanWrite = canWrite(session, "backoffice_clientes");

  const [counts, rows] = await Promise.all([
    getClientCounts(),
    listClients({ search, tier }),
  ]);

  // Drawer data
  let drawerInitial: Awaited<ReturnType<typeof getClientForEdit>> = null;
  if (drawerMode === "edit" && editId && userCanWrite) {
    drawerInitial = await getClientForEdit(editId);
  }

  return (
    <div className={styles.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>
            Gestión de cuentas de la plataforma
          </p>
        </div>
        {userCanWrite && <NewClientButton />}
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className={styles.statsBar}>
        <Stat value={counts.total} label="cuentas" />
        <Stat value={counts.enterprise} label="Enterprise" tone="purple" />
        <Stat value={counts.pro} label="Pro" tone="blue" />
        <Stat value={counts.base} label="Base" />
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <form className={styles.filterBar} action="/admin/clientes">
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Buscar por nombre, slug, industria…"
            className={styles.searchInput}
          />
        </div>
        <select
          name="tier"
          defaultValue={tier ?? ""}
          className={styles.select}
        >
          <option value="">Todos los planes</option>
          <option value="ENTERPRISE">Enterprise</option>
          <option value="PRO">Pro</option>
          <option value="BASE">Base</option>
        </select>
        <button type="submit" className={styles.applyBtn}>
          Aplicar
        </button>
        {(search || tier) && (
          <Link href="/admin/clientes" className={styles.clearLink}>
            Limpiar
          </Link>
        )}
      </form>

      {/* ── Table ──────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          {search || tier
            ? "No hay cuentas que coincidan con los filtros."
            : "No hay cuentas cargadas."}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Cliente</th>
                <th className={styles.th}>Industria</th>
                <th className={styles.th}>Plan</th>
                <th className={styles.thRight}>Vehículos</th>
                <th className={styles.thRight}>Dispositivos</th>
                <th className={styles.thRight}>Personas</th>
                <th className={styles.thRight}>Alarmas 30d</th>
                <th className={styles.th}>Alta</th>
                {userCanWrite && (
                  <th className={styles.thAction} aria-hidden="true" />
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={styles.row}>
                  <td className={styles.td}>
                    <div className={styles.clientCell}>
                      <span className={styles.clientName}>{c.name}</span>
                      <span className={styles.clientSlug}>{c.slug}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    {c.industry ? (
                      <span className={styles.dim}>{c.industry}</span>
                    ) : (
                      <span className={styles.placeholder}>—</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    <TierPill tier={c.tier} />
                  </td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    <span className={styles.num}>{c.assetCount}</span>
                  </td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    <span className={styles.num}>{c.deviceCount}</span>
                  </td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    <span className={styles.num}>{c.personCount}</span>
                  </td>
                  <td className={`${styles.td} ${styles.tdRight}`}>
                    <span
                      className={
                        c.alarmCount30d > 0 ? styles.numWarn : styles.num
                      }
                    >
                      {c.alarmCount30d}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.dim}>
                      {formatDate(c.createdAt)}
                    </span>
                  </td>
                  {userCanWrite && (
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      <ClientActionsKebab
                        accountId={c.id}
                        accountName={c.name}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Drawer ────────────────────────────────────────── */}
      {drawerMode !== "closed" && userCanWrite && (
        <ClientEditDrawer
          initialClient={drawerMode === "edit" ? drawerInitial : null}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponents
// ═══════════════════════════════════════════════════════════════

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "purple" | "blue";
}) {
  return (
    <div className={styles.stat}>
      <span
        className={`${styles.statValue} ${
          tone === "purple"
            ? styles.statValue_purple
            : tone === "blue"
              ? styles.statValue_blue
              : ""
        }`}
      >
        {value.toLocaleString("es-AR")}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function TierPill({ tier }: { tier: ClientRow["tier"] }) {
  return (
    <span className={`${styles.tierPill} ${styles[`tier_${tier}`]}`}>
      {tier === "ENTERPRISE"
        ? "Enterprise"
        : tier === "PRO"
          ? "Pro"
          : "Base"}
    </span>
  );
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}
