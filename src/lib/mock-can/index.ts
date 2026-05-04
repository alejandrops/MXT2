// ═══════════════════════════════════════════════════════════════
//  src/lib/mock-can/index.ts · public API del módulo mock CAN
// ═══════════════════════════════════════════════════════════════

export { generateCanSnapshot, getDeviceCapabilities } from "./generate";
export { resolveCanSnapshot } from "./resolve";
export type { CanSnapshot, DeviceCapabilities } from "./types";
