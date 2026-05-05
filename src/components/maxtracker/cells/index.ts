// ═══════════════════════════════════════════════════════════════
//  Cell renderers · S5-T2
//  ─────────────────────────────────────────────────────────────
//  Componentes shared para celdas de tabla y datos en paneles.
//  Garantizan formato consistente cross-app.
//
//  Uso típico desde una columna del DataTable:
//
//    import {
//      TimestampCell,
//      VehicleCell,
//      DriverCell,
//      SeverityBadge,
//    } from "@/components/maxtracker/cells";
//
//    columns: [
//      { key: "occurredAt", label: "Hora",
//        render: (r) => <TimestampCell iso={r.occurredAt} /> },
//      { key: "vehicle", label: "Vehículo",
//        render: (r) => <VehicleCell asset={r.asset} /> },
//      ...
//    ]
// ═══════════════════════════════════════════════════════════════

export { TimestampCell } from "./TimestampCell";
export { VehicleCell } from "./VehicleCell";
export { DriverCell } from "./DriverCell";
export { SeverityBadge } from "./SeverityBadge";
export { EventTypeCell } from "./EventTypeCell";
export { LocationCell } from "./LocationCell";
export { SpeedCell } from "./SpeedCell";
export { DistanceCell } from "./DistanceCell";
export { DurationCell } from "./DurationCell";
