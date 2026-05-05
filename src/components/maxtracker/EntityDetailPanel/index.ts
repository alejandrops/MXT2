// ═══════════════════════════════════════════════════════════════
//  EntityDetailPanel · S5-T2 · panel canónico
//  ─────────────────────────────────────────────────────────────
//  Sub-componentes:
//    · EntityDetailPanel    · shell con header + scroll body
//    · PanelDataSection     · grid clave/valor
//    · PanelMapSection      · mini-mapa Leaflet (3 modos)
//    · PanelCustomSection   · contenedor genérico
//    · PanelActionsSection  · botones contextuales
// ═══════════════════════════════════════════════════════════════

export { EntityDetailPanel } from "./EntityDetailPanel";
export {
  PanelDataSection,
  type DataRow,
} from "./PanelDataSection";
export { PanelMapSection } from "./PanelMapSection";
export { PanelCustomSection } from "./PanelCustomSection";
export { PanelActionsSection } from "./PanelActionsSection";
