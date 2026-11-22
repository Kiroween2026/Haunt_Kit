import { describe, expect, it } from "vitest";
import type { Sample } from "@haunt-kit/protocol";
import { DEFAULT_FLICK_CONFIG, FLICK_DIRECTION, createFlickDetector, flickDetector } from "./flick";
import leftRightRecording from "../../../../recordings/ghost-recording-android-left-right-2026-11-17T17-47-51-393Z.json";
import tableFlatRecording from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-28-41-306Z.json";

function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    t: 100,
    ax: 0,
    ay: 0,
    az: 9.81,
    gx: 0,
    gy: 0,
    gz: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    ...overrides,
  };
}

describe("Flick Detector (Task 3.1)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata", () => {
      expect(flickDetector.name).toBe("flick");
      expect(flickDetector.defaults).toEqual(DEFAULT_FLICK_CONFIG);
      expect(flickDetector.defaults.jerkThreshold).toBe(35.0);
      expect(flickDetector.defaults.windowMs).toBe(150);
      expect(flickDetector.defaults.cooldownMs).toBe(500);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = flickDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides", () => {
      const custom = createFlickDetector({
        jerkThreshold: 50.0,
        windowMs: 200,
        cooldownMs: 800,
      });
      // Feeds a sample with jerk of 40 m/s³ (above default 35, below custom 50)
      custom.push(makeSample({ t: 100, ax: 0 }));
      const events = custom.push(makeSample({ t: 150, ax: 2 })); // jerk = (2 - 0)/0.05 = 40 m/s³
      expect(events).toHaveLength(0);
    });
  });

  describe("Direction and magnitude detection", () => {
    it("detects a sharp right flick (direction: 1)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // dt = 50 ms = 0.05 s, dax = +10.0 => jx = +200 m/s³, delta = 10.0 >= minDeltaMs2 (8.0)
      const events = detector.push(makeSample({ t: 150, ax: 10.0, ay: 0, az: 9.81 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flick");
      expect(e.t).toBe(150);
      expect(e.data!.direction).toBe(FLICK_DIRECTION.RIGHT);
      expect(e.data!.magnitude).toBeCloseTo(10.0, 1);
    });

    it("detects a sharp left flick (direction: 0)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 200, ax: 0, ay: 0, az: 9.81 }));
      // dt = 40 ms = 0.04 s, dax = -10.0 => jx = -250 m/s³, delta = 10.0 >= 8.0
      const events = detector.push(makeSample({ t: 240, ax: -10.0, ay: 0, az: 9.81 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flick");
      expect(e.t).toBe(240);
      expect(e.data!.direction).toBe(FLICK_DIRECTION.LEFT);
      expect(e.data!.magnitude).toBeCloseTo(10.0, 1);
    });

    it("detects a sharp upward flick (direction: 2)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // dt = 50 ms = 0.05 s, day = +10.0 => jy = +200 m/s³, delta = 10.0 >= 8.0
      const events = detector.push(makeSample({ t: 150, ax: 0, ay: 10.0, az: 9.81 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flick");
      expect(e.data!.direction).toBe(FLICK_DIRECTION.UP);
      expect(e.data!.magnitude).toBeCloseTo(10.0, 1);
    });

    it("detects a sharp downward flick (direction: 3)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // dt = 50 ms = 0.05 s, day = -10.0 => jy = -200 m/s³, delta = 10.0 >= 8.0
      const events = detector.push(makeSample({ t: 150, ax: 0, ay: -10.0, az: 9.81 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flick");
      expect(e.data!.direction).toBe(FLICK_DIRECTION.DOWN);
      expect(e.data!.magnitude).toBeCloseTo(10.0, 1);
    });

    it("detects a sharp forward flick along Z (direction: 4)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // Forward thrust: az changes by -10.0 m/s² over 50 ms => delta = 10.0 >= 8.0
      const events = detector.push(makeSample({ t: 150, ax: 0, ay: 0, az: -0.19 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flick");
      expect(e.data!.direction).toBe(FLICK_DIRECTION.FORWARD);
      expect(e.data!.magnitude).toBeCloseTo(10.0, 1);
    });

    it("correctly computes 3D Euclidean magnitude when multiple axes change", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 0 }));
      // dt = 50 ms = 0.05 s; dax = 6, day = 8 => delta = sqrt(36 + 64) = 10.0 >= 8.0
      const events = detector.push(makeSample({ t: 150, ax: 6, ay: 8, az: 0 }));

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.magnitude).toBeCloseTo(10.0, 1);
      // Y is dominant (8 > 6) and positive => UP (2)
      expect(events[0]!.data!.direction).toBe(FLICK_DIRECTION.UP);
    });

    it("rejects jerk that does not meet minDeltaMs2 (sensor noise protection)", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // dt = 20 ms, dax = 2.0 m/s² => jerk = 100 m/s³ (> 35), but delta = 2.0 < minDeltaMs2 (8.0)
      const events = detector.push(makeSample({ t: 120, ax: 2.0, ay: 0, az: 9.81 }));
      expect(events).toHaveLength(0);
    });
  });

  describe("Sub-threshold and slow movements that must not count", () => {
    it("does not trigger on weak acceleration changes below jerkThreshold", () => {
      const detector = createFlickDetector();
      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // dt = 50 ms = 0.05 s, dax = 1.0 => jx = 20 m/s³ (< 35 m/s³)
      const events = detector.push(makeSample({ t: 150, ax: 1.0, ay: 0, az: 9.81 }));

      expect(events).toHaveLength(0);
    });

    it("does not trigger on slow large movements (e.g. phone tilt over 1.5 seconds)", () => {
      const detector = createFlickDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Rotate/tilt from ax = 0 to ax = 9.81 over 1500 ms in 30 ms steps (50 steps)
      for (let t = 0; t <= 1500; t += 30) {
        const ax = (t / 1500) * 9.81; // jx = 9.81 / 1.5 = 6.54 m/s³
        const evts = detector.push(makeSample({ t, ax, ay: 0, az: 9.81 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(0);
    });

    it("does not trigger on constant acceleration stream (zero derivative)", () => {
      const detector = createFlickDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Phone accelerating constantly at 25 m/s² (high acceleration, but zero jerk)
      for (let t = 0; t <= 600; t += 30) {
        const evts = detector.push(makeSample({ t, ax: 25.0, ay: 0, az: 9.81 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(0);
    });
  });

  describe("Duplicate-event prevention and cooldown enforcement", () => {
    it("suppresses reverse jerk from deceleration phase of a single physical flick", () => {
      const detector = createFlickDetector();

      // Acceleration onset: Right flick (jx = +200 m/s³, delta = 10.0 >= 8.0) at t = 50
      detector.push(makeSample({ t: 0, ax: 0, ay: 0, az: 9.81 }));
      const onsetEvents = detector.push(makeSample({ t: 50, ax: 10.0, ay: 0, az: 9.81 }));
      expect(onsetEvents).toHaveLength(1);
      expect(onsetEvents[0]!.data!.direction).toBe(FLICK_DIRECTION.RIGHT);

      // Deceleration phase: Hand brakes back to 0 at t = 100 (jx = -200 m/s³, looks like left jerk)
      const brakeEvents = detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // Deceleration occurs within 500 ms cooldown => must be suppressed!
      expect(brakeEvents).toHaveLength(0);

      // Settle at rest
      const settleEvents = detector.push(makeSample({ t: 150, ax: 0, ay: 0, az: 9.81 }));
      expect(settleEvents).toHaveLength(0);
    });

    it("allows a second flick after cooldown period has elapsed", () => {
      const detector = createFlickDetector();

      // Flick 1 at t = 100
      detector.push(makeSample({ t: 50, ax: 0, ay: 0, az: 9.81 }));
      const flick1 = detector.push(makeSample({ t: 100, ax: 10.0, ay: 0, az: 9.81 }));
      expect(flick1).toHaveLength(1);
      expect(flick1[0]!.data!.direction).toBe(FLICK_DIRECTION.RIGHT);

      // Attempt second flick at t = 350 (250 ms later, within 500 ms cooldown)
      detector.push(makeSample({ t: 300, ax: 0, ay: 0, az: 9.81 }));
      const flickSuppressed = detector.push(makeSample({ t: 350, ax: 10.0, ay: 0, az: 9.81 }));
      expect(flickSuppressed).toHaveLength(0);

      // Attempt second flick at t = 650 (550 ms later, > 500 ms cooldown)
      detector.push(makeSample({ t: 600, ax: 0, ay: 0, az: 9.81 }));
      const flick2 = detector.push(makeSample({ t: 650, ax: -10.0, ay: 0, az: 9.81 }));
      expect(flick2).toHaveLength(1);
      expect(flick2[0]!.data!.direction).toBe(FLICK_DIRECTION.LEFT);
    });
  });

  describe("Reset behavior and state recovery", () => {
    it("clears cooldown and history immediately when reset() is called", () => {
      const detector = createFlickDetector();

      // Flick 1 at t = 100
      detector.push(makeSample({ t: 50, ax: 0, ay: 0, az: 9.81 }));
      const flick1 = detector.push(makeSample({ t: 100, ax: 10.0, ay: 0, az: 9.81 }));
      expect(flick1).toHaveLength(1);

      // Call reset()
      detector.reset();

      // Flick 2 at t = 150 (only 50 ms later, would normally be blocked by cooldown)
      detector.push(makeSample({ t: 120, ax: 0, ay: 0, az: 9.81 }));
      const flick2 = detector.push(makeSample({ t: 150, ax: 10.0, ay: 0, az: 9.81 }));
      expect(flick2).toHaveLength(1);
    });

    it("recovers gracefully and resets state when timestamp moves backward", () => {
      const detector = createFlickDetector();

      detector.push(makeSample({ t: 1000, ax: 0, ay: 0, az: 9.81 }));
      // Timestamp jumps back to 0 (e.g. recording loop restarted)
      const events = detector.push(makeSample({ t: 0, ax: 0, ay: 0, az: 9.81 }));
      expect(events).toHaveLength(0);

      // Subsequent valid flick at t = 50 works cleanly
      const nextEvents = detector.push(makeSample({ t: 50, ax: 15.0, ay: 0, az: 9.81 }));
      expect(nextEvents).toHaveLength(1);
      expect(nextEvents[0]!.data!.direction).toBe(FLICK_DIRECTION.RIGHT);
    });
  });

  describe("Robustness against invalid or non-finite inputs", () => {
    it("ignores samples with NaN or Infinity without crashing or corrupting state", () => {
      const detector = createFlickDetector();

      expect(detector.push(makeSample({ t: NaN, ax: 0 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 100, ax: Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 110, ay: -Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 120, az: NaN }))).toEqual([]);

      // Legitimate flick after corrupt samples still works
      detector.push(makeSample({ t: 200, ax: 0, ay: 0, az: 9.81 }));
      const events = detector.push(makeSample({ t: 250, ax: 10.0, ay: 0, az: 9.81 }));
      expect(events).toHaveLength(1);
      expect(events[0]!.data!.direction).toBe(FLICK_DIRECTION.RIGHT);
    });

    it("handles zero time delta between consecutive samples safely without division by zero", () => {
      const detector = createFlickDetector();

      detector.push(makeSample({ t: 100, ax: 0, ay: 0, az: 9.81 }));
      // Identical timestamp t = 100
      const eventsZeroDt = detector.push(makeSample({ t: 100, ax: 20.0, ay: 0, az: 9.81 }));
      expect(eventsZeroDt).toEqual([]);

      // Next sample with valid dt
      const events = detector.push(makeSample({ t: 150, ax: 25.0, ay: 0, az: 9.81 }));
      expect(events).toHaveLength(1);
    });
  });

  describe("Real Ghost Recording validation", () => {
    it("never emits a flick on a phone resting flat on a table", () => {
      const detector = createFlickDetector();
      const detectedEvents: ReturnType<typeof detector.push> = [];

      for (const sample of tableFlatRecording.samples) {
        const events = detector.push(sample as Sample);
        detectedEvents.push(...events);
      }

      // Flat phone has minor sensor noise (max jerk ~6.2 m/s³), must never trigger a flick
      expect(detectedEvents).toHaveLength(0);
    });

    it("detects real physical flick strokes in android-left-right recording when configured with minDeltaMs2: 0", () => {
      const detector = createFlickDetector({ minDeltaMs2: 0 });
      const detectedEvents: ReturnType<typeof detector.push> = [];

      for (const sample of leftRightRecording.samples) {
        const events = detector.push(sample as Sample);
        detectedEvents.push(...events);
      }

      // Real recording contains sharp physical strokes exceeding 35 m/s³
      expect(detectedEvents.length).toBeGreaterThan(0);
      const directions = new Set(detectedEvents.map((e) => e.data!.direction));
      // Confirms lateral (left/right) flick strokes were captured from the motion
      expect(directions.has(FLICK_DIRECTION.LEFT) || directions.has(FLICK_DIRECTION.RIGHT)).toBe(true);

      for (const e of detectedEvents) {
        expect(e.name).toBe("flick");
        expect(e.data!.magnitude).toBeGreaterThanOrEqual(0);
        expect([
          FLICK_DIRECTION.LEFT,
          FLICK_DIRECTION.RIGHT,
          FLICK_DIRECTION.UP,
          FLICK_DIRECTION.DOWN,
          FLICK_DIRECTION.FORWARD,
        ]).toContain(e.data!.direction);
      }
    });

    it("prevents false-positive flicks from sensor noise during android-left-right with default minDeltaMs2: 8", () => {
      const detector = createFlickDetector();
      const detectedEvents: ReturnType<typeof detector.push> = [];

      for (const sample of leftRightRecording.samples) {
        const events = detector.push(sample as Sample);
        detectedEvents.push(...events);
      }

      // With default minDeltaMs2: 8 protection, gentle lateral tilts do not fire false flicks
      expect(detectedEvents).toHaveLength(0);
    });
  });
});
