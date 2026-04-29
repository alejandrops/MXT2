// ═══════════════════════════════════════════════════════════════
//  Helper · módulos aplicables al Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  Determina qué tabs del Libro mostrar según el tipo de Object
//  y qué módulos están construidos en el sistema.
//
//  El cubo del MSD: Object × Time × Module
//    · vehículo · aplica Actividad/Seguridad/Conducción/
//                Mantenimiento/Combustible
//    · conductor · aplica Actividad/Seguridad/Conducción
//    · grupo     · aplica todos los módulos (agregado)
//
//  En MVP solo Actividad y Seguridad están construidos.
//  El resto se renderizan deshabilitados con label "Próximamente".
// ═══════════════════════════════════════════════════════════════

export type ObjectType = "vehiculo" | "conductor" | "grupo";

export type ModuleKey =
  | "actividad"
  | "seguridad"
  | "conduccion"
  | "mantenimiento"
  | "combustible"
  | "logistica"
  | "documentacion"
  | "sostenibilidad";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  enabled: boolean;
}

// Módulos efectivamente construidos en el sistema (sincronizado
// con el sidebar del producto · cuando habilites un módulo nuevo
// aquí también, los Libros lo ven automáticamente).
const SYSTEM_MODULES: Record<ModuleKey, boolean> = {
  actividad: true,
  seguridad: true,
  conduccion: false,
  mantenimiento: false,
  combustible: false,
  logistica: false,
  documentacion: false,
  sostenibilidad: false,
};

// Qué módulos aplican a cada tipo de objeto (semántica del MSD).
const APPLICABLE_BY_TYPE: Record<ObjectType, ModuleKey[]> = {
  vehiculo: [
    "actividad",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
  ],
  conductor: ["actividad", "seguridad", "conduccion"],
  grupo: [
    "actividad",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
    "sostenibilidad",
  ],
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  actividad: "Actividad",
  seguridad: "Seguridad",
  conduccion: "Conducción",
  mantenimiento: "Mantenimiento",
  combustible: "Combustible",
  logistica: "Logística",
  documentacion: "Documentación",
  sostenibilidad: "Sostenibilidad",
};

/**
 * Devuelve los módulos aplicables a un tipo de objeto en el orden
 * en que deben renderizarse las tabs · primero los habilitados,
 * después los deshabilitados (próximamente).
 */
export function applicableModules(type: ObjectType): ModuleDef[] {
  return APPLICABLE_BY_TYPE[type].map((key) => ({
    key,
    label: MODULE_LABELS[key],
    enabled: SYSTEM_MODULES[key],
  }));
}

/**
 * Devuelve el primer módulo habilitado para ser default cuando se
 * entra al Libro sin tab seleccionado. Garantiza que al menos
 * uno (Actividad) está habilitado en MVP.
 */
export function defaultModule(type: ObjectType): ModuleKey {
  const mods = applicableModules(type);
  return mods.find((m) => m.enabled)?.key ?? mods[0]!.key;
}

/**
 * Valida si un módulo es aplicable + habilitado para un tipo.
 */
export function isModuleApplicable(
  type: ObjectType,
  module: ModuleKey,
): boolean {
  const mods = applicableModules(type);
  return mods.some((m) => m.key === module && m.enabled);
}
