export interface GaugeProps {
  /** Current live inclination angle in degrees relative to calibrated resting baseline */
  liveAngle?: number;
  /** Target Range of Motion (ROM) in degrees for full repetition completion */
  targetRomDeg?: number;
  /** Maximum angle display limit on the dial gauge (defaults to 180°) */
  maxAngle?: number;
  /** Optional custom accessible label for screen readers */
  ariaLabel?: string;
  /** Optional custom target label text (e.g. "Aim for 80°") */
  targetLabel?: string;
  /** Optional container CSS class name */
  className?: string;
}

const ARC_RADIUS = 90;
const ARC_LENGTH = Math.PI * ARC_RADIUS; // ~282.743
const CENTER_X = 120;
const CENTER_Y = 125;

/**
 * Circular SVG arc dial gauge for real-time physical-therapy joint inclination tracking.
 * Features:
 * - Dynamic 180° radial progress arc tracking joint excursion from resting baseline.
 * - Target ROM sector highlight and precision tick marker.
 * - Design-system token integration (Haunted, Lantern, High-Contrast themes).
 * - Safe numeric guards handling NaN, undefined, negative, or excessive sensor values.
 * - Accessible meter semantics (WCAG 2.1 AA compliant).
 */
export function Gauge({
  liveAngle,
  targetRomDeg,
  maxAngle = 180,
  ariaLabel,
  targetLabel,
  className = "",
}: GaugeProps) {
  // Safe numeric parsing & fallback guards
  const safeAngle =
    typeof liveAngle === "number" && Number.isFinite(liveAngle)
      ? Math.max(0, liveAngle)
      : 0;
  const safeTarget =
    typeof targetRomDeg === "number" && Number.isFinite(targetRomDeg)
      ? Math.max(0, targetRomDeg)
      : 60;
  const safeMax =
    typeof maxAngle === "number" && Number.isFinite(maxAngle) && maxAngle > 0
      ? maxAngle
      : 180;

  const clampedAngle = Math.min(safeMax, safeAngle);
  const fraction = safeMax > 0 ? clampedAngle / safeMax : 0;
  const strokeDashoffset = ARC_LENGTH * (1 - fraction);
  const isTargetReached = safeTarget > 0 && clampedAngle >= safeTarget;

  // Compute target marker tick coordinates (polar projection from center)
  const targetFraction = Math.min(1, safeTarget / safeMax);
  const targetRad = Math.PI * (1 - targetFraction);
  const targetInnerX = CENTER_X + (ARC_RADIUS - 9) * Math.cos(targetRad);
  const targetInnerY = CENTER_Y - (ARC_RADIUS - 9) * Math.sin(targetRad);
  const targetOuterX = CENTER_X + (ARC_RADIUS + 9) * Math.cos(targetRad);
  const targetOuterY = CENTER_Y - (ARC_RADIUS + 9) * Math.sin(targetRad);

  const roundedAngle = Math.round(clampedAngle);
  const roundedTarget = Math.round(safeTarget);
  const defaultAriaLabel = `Inclination angle: ${roundedAngle} degrees. Target is ${roundedTarget} degrees.`;

  return (
    <div
      className={`steady-gauge-container st-circular-gauge ${className}`.trim()}
      role="meter"
      aria-label={ariaLabel || defaultAriaLabel}
      aria-valuenow={roundedAngle}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-valuetext={`${roundedAngle} degrees. Target is ${roundedTarget} degrees.`}
    >
      <svg
        className="steady-gauge-svg"
        viewBox="0 0 240 155"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        {/* Background track arc (0° to 180°) using border/surface tokens */}
        <path
          d={`M ${CENTER_X - ARC_RADIUS} ${CENTER_Y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${CENTER_X + ARC_RADIUS} ${CENTER_Y}`}
          fill="none"
          stroke="var(--hk-color-border, #E2E8F0)"
          strokeOpacity="0.35"
          strokeWidth="14"
          strokeLinecap="round"
          className="gauge-track-stroke"
        />

        {/* Target range highlight zone (targetRomDeg to maxAngle) */}
        {safeTarget > 0 && safeTarget < safeMax && (
          <path
            d={`M ${CENTER_X - ARC_RADIUS} ${CENTER_Y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${CENTER_X + ARC_RADIUS} ${CENTER_Y}`}
            fill="none"
            stroke="var(--hk-color-success, #16A34A)"
            strokeOpacity="0.2"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH}`}
            strokeDashoffset={`${ARC_LENGTH * (1 - (safeMax - safeTarget) / safeMax)}`}
            className="gauge-target-zone"
          />
        )}

        {/* Live angle progress stroke - shifts from accent to success color when target achieved */}
        <path
          d={`M ${CENTER_X - ARC_RADIUS} ${CENTER_Y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${CENTER_X + ARC_RADIUS} ${CENTER_Y}`}
          fill="none"
          stroke={
            isTargetReached
              ? "var(--hk-color-success, #16A34A)"
              : "var(--hk-color-accent, #0D9488)"
          }
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH}`}
          strokeDashoffset={`${strokeDashoffset}`}
          className={`gauge-progress-stroke ${isTargetReached ? "target-reached" : ""}`}
        />

        {/* Target ROM tick marker line */}
        {safeTarget > 0 && safeTarget <= safeMax && (
          <line
            x1={targetInnerX}
            y1={targetInnerY}
            x2={targetOuterX}
            y2={targetOuterY}
            stroke={
              isTargetReached
                ? "var(--hk-color-success, #16A34A)"
                : "var(--hk-color-text, #16A34A)"
            }
            strokeWidth="3.5"
            strokeLinecap="round"
            className="gauge-target-tick"
          />
        )}

        {/* Degree labels at arc baseline */}
        <text
          x={CENTER_X - ARC_RADIUS}
          y={CENTER_Y + 18}
          fontSize="11"
          fontWeight="500"
          fill="var(--hk-color-muted, #94A3B8)"
          fontFamily="var(--hk-font-body, system-ui, sans-serif)"
          textAnchor="middle"
        >
          0°
        </text>
        <text
          x={CENTER_X}
          y={CENTER_Y - ARC_RADIUS - 8}
          fontSize="11"
          fontWeight="500"
          fill="var(--hk-color-muted, #94A3B8)"
          fontFamily="var(--hk-font-body, system-ui, sans-serif)"
          textAnchor="middle"
        >
          {`${Math.round(safeMax / 2)}°`}
        </text>
        <text
          x={CENTER_X + ARC_RADIUS}
          y={CENTER_Y + 18}
          fontSize="11"
          fontWeight="500"
          fill="var(--hk-color-muted, #94A3B8)"
          fontFamily="var(--hk-font-body, system-ui, sans-serif)"
          textAnchor="middle"
        >
          {`${Math.round(safeMax)}°`}
        </text>

        {/* Central numerical angle readout */}
        <text
          x={CENTER_X}
          y={CENTER_Y - 14}
          fontSize="36"
          fontWeight="700"
          fill={
            isTargetReached
              ? "var(--hk-color-success, #16A34A)"
              : "var(--hk-color-text, #0F172A)"
          }
          fontFamily="var(--hk-font-heading, var(--hk-font-body, system-ui, sans-serif))"
          textAnchor="middle"
          className="gauge-angle-readout"
        >
          {`${roundedAngle}°`}
        </text>

        {/* Target indication subtitle */}
        <text
          x={CENTER_X}
          y={CENTER_Y + 8}
          fontSize="12"
          fontWeight="600"
          fill="var(--hk-color-muted, #64748B)"
          fontFamily="var(--hk-font-body, system-ui, sans-serif)"
          textAnchor="middle"
          className="gauge-target-label"
        >
          {targetLabel || `Target: ${roundedTarget}°`}
        </text>
      </svg>
    </div>
  );
}
