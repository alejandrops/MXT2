// ═══════════════════════════════════════════════════════════════
//  Helper · módulos aplicables al Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  Determina qué tabs del Libro mostrar según el tipo de Object
//  y qué módulos están construidos en el sistema.
//
//  El cubo del MSD: Object × Time × Module
//
//  Matriz validada (S1-L4 + L5):
//
//    | Tab              | vehículo | conductor | grupo |
//    |------------------|----------|-----------|-------|
//    | Telemetría 🆕    |    ✓     |     ✗     |   ✗   | (intrínseca al vehículo)
//    | Conductores 🆕   |    ✓     |     ✗     |   ✗   | (intrínseca al vehículo)
//    | Actividad        |    ✓     |     ✓     |   ✓   |
//    | Seguridad        |    ✓     |     ✓     |   ✓   |
//    | Conducción       |    ✓     |     ✓     |   ✓   |
//    | Mantenimiento    |    ✓     |     ✗     |   ✓   |
//    | Combustible      |    ✓     |     ✗     |   ✓   |
//    | Logística        |    ✓     |     ✗     |   ✓   |
//    | Documentación    |    ✓     |     ✓     |   ✗   |
//    | Sostenibilidad   |    ✓     |     ✗     |   ✓   |
//
//  Nota arquitectónica · "telemetria" y "conductores" son tabs
//  intrínsecas del vehículo (no son módulos del cubo · no aparecen
//  en sidebar). Viven acá como ModuleKey por simplicidad · si crece
//  el modelo de tabs del Libro, valdría refactor a "BookTabKey" con
//  dos sources (module / intrinsic).
// ═══════════════════════════════════════════════════════════════

export type ObjectType = "vehiculo" | "conductor" | "grupo";

export type ModuleKey =
  | "telemetria"
  | "conductores"
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

// Tabs efectivamente construidas en el sistema. Mantener sincronizado
// con el sidebar y los SwitchCases del page.tsx del Libro.
const SYSTEM_MODULES: Record<ModuleKey, boolean> = {
  telemetria: true, // S1-L4 · habilitada · tab nueva con datos CAN
  conductores: true, // S1-L5 · habilitada · historial de quién manejó
  actividad: true,
  seguridad: true,
  conduccion: true, // S1-L2 · habilitada · scorecard activo, resto Sprint 4
  mantenimiento: false,
  combustible: false,
  logistica: false,
  documentacion: false,
  sostenibilidad: false,
};

// Qué módulos aplican a cada tipo de objeto · matriz validada.
// El orden define cómo se renderizan las tabs del Libro.
const APPLICABLE_BY_TYPE: Record<ObjectType, ModuleKey[]> = {
  vehiculo: [
    "telemetria",
    "conductores",
    "actividad",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
    "logistica",
    "documentacion",
    "sostenibilidad",
  ],
  conductor: [
    "actividad",
    "seguridad",
    "conduccion",
    "documentacion",
  ],
  grupo: [
    "actividad",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
    "logistica",
    "sostenibilidad",
  ],
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  telemetria: "Telemetría",
  conductores: "Conductores",
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
