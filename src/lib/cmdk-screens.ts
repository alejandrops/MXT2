// ═══════════════════════════════════════════════════════════════
//  Pantallas accesibles desde Cmd+K (search global)
//  ─────────────────────────────────────────────────────────────
//  Lista hardcodeada · sincronizada con el sidebar del producto.
//  Cuando agregues una pantalla al sidebar y la quieras hacer
//  buscable acá, agregala a este array.
//
//  Cada entry tiene:
//    · label · cómo se muestra al usuario
//    · keywords · lista de palabras que matchean además del label
//      (sinónimos · ej: "tablero" matchea "Dashboard")
//    · href · destino al click
//    · module · módulo del sidebar (para agrupar/badge)
// ═══════════════════════════════════════════════════════════════

export interface ScreenEntry {
  label: string;
  keywords: string[];
  href: string;
  module: string;
}

export const SCREENS: ScreenEntry[] = [
  // Seguimiento
  {
    label: "Mapa",
    keywords: ["mapa", "tracking", "tiempo real", "live"],
    href: "/seguimiento/mapa",
    module: "Seguimiento",
  },
  {
    label: "Historial",
    keywords: ["historial", "trayectos", "rutas", "playback"],
    href: "/seguimiento/historial",
    module: "Seguimiento",
  },
  {
    label: "Torre de control",
    keywords: ["torre", "control", "operador", "despacho"],
    href: "/seguimiento/torre-de-control",
    module: "Seguimiento",
  },

  // Actividad
  {
    label: "Reportes",
    keywords: [
      "reportes",
      "analisis",
      "análisis",
      "tabla",
      "pivot",
      "heatmap",
      "matriz",
      "ranking",
      "export",
    ],
    href: "/actividad/reportes",
    module: "Actividad",
  },
  {
    label: "Scorecard",
    keywords: ["scorecard", "ranking", "conductores", "score"],
    href: "/actividad/scorecard",
    module: "Actividad",
  },
  {
    label: "Viajes",
    keywords: ["viajes", "trips", "recorridos"],
    href: "/actividad/viajes",
    module: "Actividad",
  },

  // Seguridad
  {
    label: "Dashboard de seguridad",
    keywords: ["seguridad", "dashboard"],
    href: "/seguridad/dashboard",
    module: "Seguridad",
  },
  {
    label: "Alarmas",
    keywords: ["alarmas", "alertas", "incidentes"],
    href: "/seguridad/alarmas",
    module: "Seguridad",
  },

  // Dirección
  {
    label: "Vista ejecutiva",
    keywords: ["vista", "ejecutiva", "dashboard", "tablero", "ceo", "director"],
    href: "/direccion/vista-ejecutiva",
    module: "Dirección",
  },
  {
    label: "Distribución por grupo",
    keywords: ["distribucion", "distribución", "grupos", "boxplot", "box"],
    href: "/direccion/distribucion-grupos",
    module: "Dirección",
  },

  // Catálogos (índices)
  {
    label: "Catálogos · Vehículos",
    keywords: [
      "vehiculos",
      "vehículos",
      "flota",
      "assets",
      "catalogo",
      "catálogo",
      "gestion",
      "listado",
    ],
    href: "/catalogos/vehiculos",
    module: "Catálogos",
  },
  {
    label: "Catálogos · Conductores",
    keywords: [
      "conductores",
      "drivers",
      "personas",
      "catalogo",
      "catálogo",
      "gestion",
      "listado",
    ],
    href: "/catalogos/conductores",
    module: "Catálogos",
  },
  {
    label: "Catálogos · Grupos",
    keywords: [
      "grupos",
      "groups",
      "catalogo",
      "catálogo",
      "gestion",
      "listado",
    ],
    href: "/catalogos/grupos",
    module: "Catálogos",
  },
  // Boletín (subitem nuevo de Dirección · Lote Boletín 1)
  {
    label: "Boletín mensual",
    keywords: [
      "boletin",
      "boletín",
      "mensual",
      "reporte",
      "cierre",
      "informe",
    ],
    href: "/direccion/boletin",
    module: "Dirección",
  },
];

/**
 * Devuelve hasta 5 pantallas que matchean el query.
 * Match case-insensitive contra label + keywords.
 */
export function searchScreens(query: string): ScreenEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matches = SCREENS.filter((s) => {
    if (s.label.toLowerCase().includes(q)) return true;
    return s.keywords.some((k) => k.toLowerCase().includes(q));
  });

  return matches.slice(0, 5);
}
