// ═══════════════════════════════════════════════════════════════
//  Helper · módulos aplicables al Libro del Objeto
//  ─────────────────────────────────────────────────────────────
//  Determina qué tabs del Libro mostrar según el tipo de Object
//  y qué módulos están construidos en el sistema.
//
//  El cubo del MSD: Object × Time × Module
//
//  S4-L1 · estructura nueva del Libro del Objeto
//
//  Matriz validada:
//
//    | Tab           | vehículo | conductor | grupo |
//    |---------------|----------|-----------|-------|
//    | Carátula 🆕   |    ✓     |     ✓     |   ✓   | (vista 360° del ahora · era "resumen")
//    | Resumen 🆕    |    ✓     |     ✓     |   ✓   | (KPIs + bullet del período · NUEVO)
//    | Evolución 🆕  |    ✓     |     ✓     |   ✓   | (gráficos temporales · NUEVO)
//    | Viajes 🆕     |    ✓     |     ✓     |   ✓   | (listado day-by-day · NUEVO)
//    | Paradas 🆕    |    ✓     |     ✓     |   ✓   | (listado · NUEVO)
//    | Telemetría    |    ✓     |     ✗     |   ✗   | (intrínseca al vehículo)
//    | Conductores   |    ✓     |     ✗     |   ✗   | (intrínseca al vehículo)
//    | Seguridad     |    ✓     |     ✓     |   ✓   |
//    | Conducción    |    ✓     |     ✓     |   ✓   |
//    | Mantenimiento |    ✓     |     ✗     |   ✓   |
//    | Combustible   |    ✓     |     ✗     |   ✓   |
//    | Logística     |    ✓     |     ✗     |   ✓   |
//    | Documentación |    ✓     |     ✓     |   ✗   |
//    | Sostenibilid. |    ✓     |     ✗     |   ✓   |
//
//  S4-L1 · "Actividad" REMOVIDA (era redundante con los 4 nuevos).
//  Su contenido (KPIs, peers, lista cronológica) se distribuyó en
//  Carátula, Resumen, Evolución, Viajes y Paradas.
// ═══════════════════════════════════════════════════════════════

export type ObjectType = "vehiculo" | "conductor" | "grupo";

export type ModuleKey =
  | "caratula"
  | "resumen"
  | "evolucion"
  | "viajes"
  | "paradas"
  | "telemetria"
  | "conductores"
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

const SYSTEM_MODULES: Record<ModuleKey, boolean> = {
  caratula: true,
  resumen: true,
  evolucion: true,
  viajes: true,
  paradas: true,
  telemetria: true,
  conductores: true,
  seguridad: true,
  conduccion: true,
  mantenimiento: false,
  combustible: false,
  logistica: false,
  documentacion: false,
  sostenibilidad: false,
};

const APPLICABLE_BY_TYPE: Record<ObjectType, ModuleKey[]> = {
  vehiculo: [
    "caratula",
    "resumen",
    "evolucion",
    "viajes",
    "paradas",
    "telemetria",
    "conductores",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
    "logistica",
    "documentacion",
    "sostenibilidad",
  ],
  conductor: [
    "caratula",
    "resumen",
    "evolucion",
    "viajes",
    "paradas",
    "seguridad",
    "conduccion",
    "documentacion",
  ],
  grupo: [
    "caratula",
    "resumen",
    "evolucion",
    "viajes",
    "paradas",
    "seguridad",
    "conduccion",
    "mantenimiento",
    "combustible",
    "logistica",
    "sostenibilidad",
  ],
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  caratula: "Carátula",
  resumen: "Resumen",
  evolucion: "Evolución",
  viajes: "Viajes",
  paradas: "Paradas",
  telemetria: "Telemetría",
  conductores: "Conductores",
  seguridad: "Seguridad",
  conduccion: "Conducción",
  mantenimiento: "Mantenimiento",
  combustible: "Combustible",
  logistica: "Logística",
  documentacion: "Documentación",
  sostenibilidad: "Sostenibilidad",
};

export function applicableModules(type: ObjectType): ModuleDef[] {
  return APPLICABLE_BY_TYPE[type].map((key) => ({
    key,
    label: MODULE_LABELS[key],
    enabled: SYSTEM_MODULES[key],
  }));
}

export function defaultModule(type: ObjectType): ModuleKey {
  const mods = applicableModules(type);
  return mods.find((m) => m.enabled)?.key ?? mods[0]!.key;
}

export function isModuleApplicable(
  type: ObjectType,
  module: ModuleKey,
): boolean {
  const mods = applicableModules(type);
  return mods.some((m) => m.key === module && m.enabled);
}
