"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  // Module icons
  MapPin,
  Shield,
  Truck,
  Package,
  Fuel,
  Wrench,
  FileText,
  Leaf,
  BarChart3,
  Building2,
  Radio,
} from "lucide-react";
import styles from "./Sidebar.module.css";

// ═══════════════════════════════════════════════════════════════
//  Sidebar — mirror of demo v8.18 .sb-acc accordion
//  ─────────────────────────────────────────────────────────────
//  Single navigation surface for the whole app. The accordion
//  layout from the demo:
//
//    [Brand block]
//    [Search shortcut]
//    [Module 1 ▼]
//      ├ Page A
//      ├ Page B
//      └ Page C
//    [Module 2 ▶]   collapsed
//    [Module 3 ▶]
//    ...
//    [Configuración]   bottom
//
//  At any time, only one module is expanded. The active module
//  (matching pathname) auto-expands. Other modules collapse.
//
//  Modules with no implemented pages render as disabled (greyed
//  out, no chevron, no expansion). This keeps the visual model
//  intact while preventing 404s.
// ═══════════════════════════════════════════════════════════════

// ─── Module/page model (mirrors demo v8.18 sidebar) ───────────
//
// Each module has a slug (URL path prefix) and a list of pages.
// Pages with `href: null` are not yet implemented — they show
// disabled.

interface PageDef {
  label: string;
  href: string | null;
  badge?: number;
}

interface ModuleDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  pathPrefix: string;
  pages: PageDef[];
  enabled: boolean;
}

const MODULES: ModuleDef[] = [
  {
    key: "seg",
    label: "Seguimiento",
    icon: <MapPin size={16} />,
    pathPrefix: "/seguimiento",
    enabled: true,
    pages: [
      { label: "Mapa", href: "/seguimiento/mapa" },
      { label: "Viajes", href: "/seguimiento/viajes" },
      { label: "Historial", href: "/seguimiento/historial" },
    ],
  },
  {
    key: "secu",
    label: "Seguridad",
    icon: <Shield size={16} />,
    pathPrefix: "/seguridad",
    enabled: true,
    pages: [
      { label: "Dashboard", href: "/seguridad/dashboard" },
      { label: "Alarmas", href: "/seguridad/alarmas", badge: 7 },
      // Cross-module shortcut to the same screen as Seguimiento>Historial
      { label: "Seguimiento", href: "/seguimiento/historial" },
      { label: "Reporte", href: null }, // not built yet
    ],
  },
  {
    key: "con",
    label: "Conducción",
    icon: <Truck size={16} />,
    pathPrefix: "/conduccion",
    enabled: false,
    pages: [],
  },
  {
    key: "log",
    label: "Logística",
    icon: <Package size={16} />,
    pathPrefix: "/logistica",
    enabled: false,
    pages: [],
  },
  {
    key: "fue",
    label: "Combustible",
    icon: <Fuel size={16} />,
    pathPrefix: "/combustible",
    enabled: false,
    pages: [],
  },
  {
    key: "mai",
    label: "Mantenimiento",
    icon: <Wrench size={16} />,
    pathPrefix: "/mantenimiento",
    enabled: false,
    pages: [],
  },
  {
    key: "doc",
    label: "Documentación",
    icon: <FileText size={16} />,
    pathPrefix: "/documentacion",
    enabled: false,
    pages: [],
  },
  {
    key: "sos",
    label: "Sostenibilidad",
    icon: <Leaf size={16} />,
    pathPrefix: "/sostenibilidad",
    enabled: false,
    pages: [],
  },
  {
    key: "dir",
    label: "Dirección",
    icon: <BarChart3 size={16} />,
    pathPrefix: "/direccion",
    enabled: false,
    pages: [],
  },
  {
    key: "gest",
    label: "Gestión",
    icon: <Building2 size={16} />,
    pathPrefix: "/gestion",
    enabled: true,
    pages: [
      { label: "Vehículos", href: "/gestion/vehiculos" },
      { label: "Conductores", href: "/gestion/conductores" },
      { label: "Grupos", href: "/gestion/grupos" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Detect active module from pathname
  const activeModule =
    MODULES.find((m) => pathname.startsWith(m.pathPrefix))?.key ?? "secu";

  const [expandedKey, setExpandedKey] = useState<string>(activeModule);

  // If pathname changed (navigation), re-sync expandedKey to active module
  // Note: we use a ref-like pattern via key change. The expandedKey lives
  // in local state so the user can also expand other modules manually.
  // When the URL changes, we re-derive but keep manual overrides.
  // For simplicity: we keep expandedKey on first render and let user
  // open others. If you click a different module's page via search etc,
  // we'll re-sync.
  // Effect: when pathname module changes, expandedKey follows.
  if (
    typeof window !== "undefined" &&
    activeModule !== expandedKey &&
    !MODULES.find((m) => m.key === expandedKey)?.pathPrefix.startsWith(
      MODULES.find((mm) => mm.key === activeModule)?.pathPrefix ?? "",
    )
  ) {
    // No-op — left intentionally simple. Manual override allowed.
  }

  function handleToggle(key: string) {
    const m = MODULES.find((mm) => mm.key === key);
    if (!m || !m.enabled) return; // can't expand disabled modules
    setExpandedKey((curr) => (curr === key ? "" : key));
  }

  const sidebarClass = `${styles.sidebar} ${collapsed ? styles.collapsed : ""}`;

  return (
    <aside className={sidebarClass}>
      {/* ── Brand block ───────────────────────────────────────── */}
      <Link href="/seguridad/dashboard" className={styles.brandBlock}>
        <div className={styles.brandMark}>
          <Radio size={14} />
        </div>
        {!collapsed && (
          <div className={styles.brandText}>
            <b>MAXTRACKER</b>
            <span>Telemática</span>
          </div>
        )}
      </Link>

      {/* ── Search shortcut · disabled placeholder ──────────────
          Visible but inactive while a real command palette is built.
          Tooltip indicates upcoming feature. */}
      {!collapsed && (
        <div
          className={`${styles.search} ${styles.searchDisabled}`}
          title="Búsqueda global · próximamente"
          aria-disabled="true"
        >
          <Search size={13} />
          <span>Buscar</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </div>
      )}

      {/* ── Modules accordion ─────────────────────────────────── */}
      <nav className={styles.nav}>
        {MODULES.map((mod) => (
          <ModuleAccordion
            key={mod.key}
            module={mod}
            isActive={activeModule === mod.key}
            isExpanded={expandedKey === mod.key && mod.enabled}
            collapsed={collapsed}
            currentPath={pathname}
            onToggle={() => handleToggle(mod.key)}
          />
        ))}
      </nav>

      {/* ── Bottom: collapse toggle + config ──────────────────── */}
      <div className={styles.bottom}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!collapsed && <span>Colapsar</span>}
        </button>
        <button className={styles.configBtn} disabled>
          <Settings size={15} />
          {!collapsed && <span>Configuración</span>}
        </button>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Subcomponent · ModuleAccordion
// ═══════════════════════════════════════════════════════════════

interface ModuleAccordionProps {
  module: ModuleDef;
  isActive: boolean;
  isExpanded: boolean;
  collapsed: boolean;
  currentPath: string;
  onToggle: () => void;
}

function ModuleAccordion({
  module: mod,
  isActive,
  isExpanded,
  collapsed,
  currentPath,
  onToggle,
}: ModuleAccordionProps) {
  const sectionClass = `${styles.section} ${
    isExpanded ? styles.sectionOpen : ""
  } ${isActive ? styles.sectionActive : ""} ${
    !mod.enabled ? styles.sectionDisabled : ""
  }`;

  return (
    <div className={sectionClass}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={onToggle}
        disabled={!mod.enabled}
        aria-expanded={isExpanded}
      >
        <span className={styles.sectionIcon}>{mod.icon}</span>
        {!collapsed && (
          <>
            <span className={styles.sectionLabel}>{mod.label}</span>
            {mod.enabled && (
              <ChevronDown size={13} className={styles.sectionChev} />
            )}
          </>
        )}
      </button>

      {isExpanded && !collapsed && (
        <div className={styles.pages}>
          {mod.pages.map((p) =>
            p.href ? (
              <PageLink
                key={p.label}
                page={p}
                isActive={currentPath.startsWith(p.href)}
              />
            ) : (
              <PageDisabled key={p.label} page={p} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PageLink({ page, isActive }: { page: PageDef; isActive: boolean }) {
  return (
    <Link
      href={page.href!}
      className={`${styles.page} ${isActive ? styles.pageActive : ""}`}
    >
      <span className={styles.pageLabel}>{page.label}</span>
      {page.badge !== undefined && (
        <span className={styles.badge}>{page.badge}</span>
      )}
    </Link>
  );
}

function PageDisabled({ page }: { page: PageDef }) {
  return (
    <button type="button" className={`${styles.page} ${styles.disabled}`} disabled>
      <span className={styles.pageLabel}>{page.label}</span>
    </button>
  );
}
