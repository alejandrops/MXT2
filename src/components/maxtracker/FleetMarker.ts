import type { CommState, MotorState } from "@/lib/queries/tracking";

// ═══════════════════════════════════════════════════════════════
//  FleetMarker · HTML factory for Leaflet divIcon
//  ─────────────────────────────────────────────────────────────
//  Returns an HTML string used by Leaflet's L.divIcon. The marker
//  has 3 visual layers:
//
//    1. Shape · indicates motor state
//       · ▶ play triangle (rotated to heading)  · MOVING
//       · ❚❚ pause icon                          · STOPPED (idle)
//       · ■ square                              · OFF
//
//    2. Background color · driven by display mode
//       · "fleet" mode → group color
//       · "status" mode → neutral dark blue, lets shape carry info
//
//    3. Comm dot · small colored dot at bottom-right
//       · green · ONLINE
//       · yellow · RECENT
//       · orange · STALE
//       · red · LONG
//       · gray · NO_COMM (only shown if "show no comm" toggle on)
//
//    4. (optional) plate label below the marker
// ═══════════════════════════════════════════════════════════════

export type FleetMarkerColorMode = "fleet" | "status";

export type VehicleTypeIcon =
  | "CAR"
  | "MOTORCYCLE"
  | "TRUCK"
  | "HEAVY_MACHINERY"
  | "TRAILER"
  | "SILO"
  | "GENERIC";

export interface FleetMarkerOpts {
  motor: MotorState;
  comm: CommState;
  heading: number;
  /** Color of the asset's group (used in "fleet" mode) */
  groupColor: string;
  /** Show plate text below marker */
  showPlate: boolean;
  plate?: string | null;
  colorMode: FleetMarkerColorMode;
  /** When true, swap the motor-state shape for a vehicle-type icon */
  showTypeIcon: boolean;
  vehicleType?: VehicleTypeIcon;
}

const STATUS_BG: Record<MotorState, string> = {
  MOVING: "#1e3a8a", // dark blue
  STOPPED: "#475569", // slate
  OFF: "#9ca3af", // gray
};

const COMM_DOT: Record<CommState, string> = {
  ONLINE: "#16a34a", // green
  RECENT: "#eab308", // yellow
  STALE: "#ea580c", // orange
  LONG: "#dc2626", // red
  NO_COMM: "#6b7280", // gray
};

const OUTLINE = "#ffffff";

export function buildFleetMarkerHtml(opts: FleetMarkerOpts): string {
  const bg =
    opts.colorMode === "fleet" ? opts.groupColor : STATUS_BG[opts.motor];
  const dotColor = COMM_DOT[opts.comm];

  // Marker grows substantially when icon-by-type is on so the
  // detailed silhouettes are legible. Otherwise, compact circle
  // with the motor-state shape.
  const useTypeIcon = opts.showTypeIcon && opts.vehicleType;
  const SIZE = useTypeIcon ? 36 : 26;
  const COMM_DOT_SIZE = useTypeIcon ? 11 : 9;

  const inner = useTypeIcon
    ? renderTypeIcon(opts.vehicleType!, opts.heading, opts.motor)
    : renderShape(opts.motor, opts.heading);

  const ringOpacity = opts.motor === "OFF" ? 0.55 : 1;

  const plateLabel =
    opts.showPlate && opts.plate
      ? `<div style="
          margin-top: 2px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          color: #1f2937;
          background: rgba(255,255,255,0.92);
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid rgba(0,0,0,0.1);
          white-space: nowrap;
          text-align: center;
          font-weight: 600;
        ">${escapeHtml(opts.plate)}</div>`
      : "";

  return `<div style="
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  ">
    <div style="
      position: relative;
      width: ${SIZE}px;
      height: ${SIZE}px;
      border-radius: 50%;
      background: ${bg};
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid ${OUTLINE};
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.18),
        0 1px 3px rgba(0,0,0,0.25);
      opacity: ${ringOpacity};
    ">
      ${inner}
      <span style="
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: ${COMM_DOT_SIZE}px;
        height: ${COMM_DOT_SIZE}px;
        border-radius: 50%;
        background: ${dotColor};
        border: 1.5px solid ${OUTLINE};
        box-shadow: 0 0 0 1px rgba(0,0,0,0.15);
      "></span>
    </div>
    ${plateLabel}
  </div>`;
}

function renderShape(motor: MotorState, heading: number): string {
  if (motor === "MOVING") {
    return `<svg width="13" height="13" viewBox="0 0 14 14"
              style="transform: rotate(${heading}deg); transition: transform 0.2s linear;">
      <path d="M7 1 L12 12 L7 9.5 L2 12 Z"
            fill="${OUTLINE}"
            stroke="${OUTLINE}" stroke-width="0.6" stroke-linejoin="round"/>
    </svg>`;
  }
  if (motor === "STOPPED") {
    return `<svg width="11" height="11" viewBox="0 0 12 12">
      <rect x="2.5" y="2" width="2.5" height="8" fill="${OUTLINE}" rx="0.5"/>
      <rect x="7" y="2" width="2.5" height="8" fill="${OUTLINE}" rx="0.5"/>
    </svg>`;
  }
  return `<svg width="10" height="10" viewBox="0 0 11 11">
    <rect x="1.5" y="1.5" width="8" height="8" fill="${OUTLINE}" rx="1"/>
  </svg>`;
}

/**
 * Vehicle-type icon · used when "Íconos por tipo" is on. Uses
 * lucide-react geometry (24x24 viewBox) for clarity. Icons rotate
 * with heading for directional vehicles when MOVING.
 *
 * Returned at the same dimensions Leaflet expects regardless of
 * type — the marker WRAPPER scales when icon mode is on (see
 * caller for the size math).
 */
function renderTypeIcon(
  type: VehicleTypeIcon,
  heading: number,
  motor: MotorState,
): string {
  // Rotate only directional vehicles when actually moving.
  // Stationary types (silo, machinery) and non-moving states
  // get a fixed orientation.
  const directionalAndMoving =
    motor === "MOVING" &&
    (type === "TRUCK" || type === "CAR" || type === "MOTORCYCLE");
  const transform = directionalAndMoving
    ? `style="transform: rotate(${heading}deg); transition: transform 0.4s linear; transform-origin: 12px 12px;"`
    : "";

  // Common wrapper · 24x24 viewBox, white stroke, 2.2 weight to
  // stay legible against colored backgrounds.
  const path = ICON_PATHS[type];
  return `<svg width="20" height="20" viewBox="0 0 24 24"
              fill="none" stroke="${OUTLINE}"
              stroke-width="2.2" stroke-linecap="round"
              stroke-linejoin="round" ${transform}>
    ${path}
  </svg>`;
}

/**
 * Lucide icon path geometry. We mirror what `lucide-react`'s
 * Truck/Car/Bike/Tractor/Warehouse components draw, embedded
 * directly so we can ship them inside Leaflet divIcon HTML
 * strings (we can't render React inside marker HTML).
 */
const ICON_PATHS: Record<VehicleTypeIcon, string> = {
  TRUCK: `
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
    <path d="M15 18H9"/>
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
    <circle cx="17" cy="18" r="2"/>
    <circle cx="7" cy="18" r="2"/>
  `,
  CAR: `
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  `,
  MOTORCYCLE: `
    <circle cx="18.5" cy="17.5" r="3.5"/>
    <circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="15" cy="5" r="1"/>
    <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
  `,
  HEAVY_MACHINERY: `
    <path d="m10 11 11 .9c.6 0 .9.5.8 1l-1 5.4c-.1.5-.6.9-1.1.9h-1.5"/>
    <path d="M16 18h-5"/>
    <path d="M18 5a1 1 0 0 0-1 1v5.6"/>
    <path d="M10 6h4"/>
    <path d="M10 18H5c-.6 0-1.1-.5-1-1.2l1-3C5.1 13.6 5.5 13 6 13h7"/>
    <circle cx="7.5" cy="18" r="2.5"/>
    <path d="M3 13l1-3"/>
  `,
  TRAILER: `
    <path d="M22 17h-3.5a2.5 2.5 0 0 1-5 0H10"/>
    <rect x="3" y="6" width="13" height="11" rx="1"/>
    <circle cx="16" cy="17" r="1.5"/>
    <path d="M19 17h.01"/>
  `,
  SILO: `
    <path d="M3 22V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/>
    <path d="M3 22h18"/>
    <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
    <path d="M9 22v-5h6v5"/>
  `,
  GENERIC: `
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 3"/>
  `,
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
    }
    return c;
  });
}
