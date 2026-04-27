// ═══════════════════════════════════════════════════════════════
//  MotorGlyph · pixel-perfect SVG icon for the 3 motor states
//  ─────────────────────────────────────────────────────────────
//  Replaces inline Unicode chars (■ ❚❚ ▶) which had inconsistent
//  optical centering across fonts/platforms. SVG paths are drawn
//  on a centered viewBox so the glyph always sits dead-center
//  inside its container.
//
//  Usage:
//    <MotorGlyph state="MOVING" size={10} />
// ═══════════════════════════════════════════════════════════════

interface MotorGlyphProps {
  state: "MOVING" | "STOPPED" | "OFF";
  /** Size in px · refers to width AND height. Default 10. */
  size?: number;
  className?: string;
}

export function MotorGlyph({
  state,
  size = 10,
  className,
}: MotorGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {state === "MOVING" && (
        // Right-pointing triangle · centered on (6, 6) · larger
        // than before so it reads well even at 10-12px render size
        <path d="M 2.5 1.5 L 10.5 6 L 2.5 10.5 Z" fill="currentColor" />
      )}
      {state === "STOPPED" && (
        // Two vertical bars · thicker so they don't feel anemic
        <g fill="currentColor">
          <rect x="2.5" y="2" width="2.5" height="8" rx="0.4" />
          <rect x="7" y="2" width="2.5" height="8" rx="0.4" />
        </g>
      )}
      {state === "OFF" && (
        // Centered square · expanded from 6 to 8 across the
        // 12-unit viewBox so it visually balances with MOVING/STOPPED
        <rect x="2" y="2" width="8" height="8" rx="0.6" fill="currentColor" />
      )}
    </svg>
  );
}
