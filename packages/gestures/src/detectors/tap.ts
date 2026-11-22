// Built by Yadnesh for Anish's gestures package (Anish is out this week). Owner: Anish.
import type { Detector, GestureEvent, Sample } from "@haunt-kit/protocol";

/**
 * Configuration options for the Tap Detector.
 */
export interface TapConfig {
  /**
   * Minimum interval in milliseconds between consecutive tap events to prevent double-tap bounce.
   * Default: 0 ms (permits all discrete tap events).
   */
  minIntervalMs?: number;
  /**
   * Alias for minIntervalMs following project cooldown conventions.
   */
  cooldownMs?: number;
}

export const DEFAULT_TAP_CONFIG: TapConfig = {
  minIntervalMs: 0,
  cooldownMs: 0,
};

/**
 * Extended sample representation that can carry synthetic screen touch data.
 */
export interface TapSample extends Sample {
  /** Normalized horizontal coordinate (0.0 to 1.0) */
  x?: number;
  /** Normalized vertical coordinate (0.0 to 1.0) */
  y?: number;
  /** Optional nested touch object */
  touch?: { x: number; y: number };
  /** Optional tap trigger payload */
  tap?: boolean | { x: number; y: number };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/** A tap event with x and y as fractions of the screen (0..1). */
export function makeTapEvent(x: number, y: number, t: number): GestureEvent {
  return { name: "tap", t, data: { x: clamp01(x), y: clamp01(y) } };
}

export function createTapDetector(customConfig?: Partial<TapConfig>) {
  const config = { ...DEFAULT_TAP_CONFIG, ...customConfig };
  const minInterval = Math.max(0, config.minIntervalMs ?? config.cooldownMs ?? 0);
  let lastEventTime: number | null = null;
  let prevTime: number | null = null;

  return {
    push(s?: Sample): GestureEvent[] {
      if (!s) return [];
      const { t } = s;
      if (!Number.isFinite(t)) return [];
      if (prevTime !== null && t < prevTime) {
        lastEventTime = null;
      }
      prevTime = t;

      const raw = s as TapSample;
      let rawX: number | undefined;
      let rawY: number | undefined;

      if (typeof raw.x === "number") rawX = raw.x;
      else if (raw.touch && typeof raw.touch.x === "number") rawX = raw.touch.x;
      else if (raw.tap && typeof raw.tap === "object" && typeof raw.tap.x === "number") rawX = raw.tap.x;

      if (typeof raw.y === "number") rawY = raw.y;
      else if (raw.touch && typeof raw.touch.y === "number") rawY = raw.touch.y;
      else if (raw.tap && typeof raw.tap === "object" && typeof raw.tap.y === "number") rawY = raw.tap.y;

      if (rawX === undefined || rawY === undefined || !Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return [];
      }

      if (lastEventTime !== null && minInterval > 0 && t - lastEventTime < minInterval) {
        return [];
      }

      const clampedX = Math.max(0, Math.min(1, rawX));
      const clampedY = Math.max(0, Math.min(1, rawY));
      const cleanX = Object.is(clampedX, -0) || clampedX === 0 ? 0 : clampedX;
      const cleanY = Object.is(clampedY, -0) || clampedY === 0 ? 0 : clampedY;
      lastEventTime = t;

      return [{ name: "tap", t, data: { x: cleanX, y: cleanY } }];
    },
    reset(): void {
      lastEventTime = null;
      prevTime = null;
    },
  };
}

export const tapDetector = {
  name: "tap",
  defaults: DEFAULT_TAP_CONFIG,
  create(config: Partial<TapConfig> = DEFAULT_TAP_CONFIG) {
    return createTapDetector(config);
  },
} satisfies Detector<TapConfig>;
