import { describe, expect, it } from "vitest";
import type { Sample } from "@haunt-kit/protocol";
import { DEFAULT_SPIN_CONFIG, SPIN_DIRECTION, createSpinDetector, spinDetector } from "./spin";
import leftRightRecording from "../../../../recordings/ghost-recording-android-left-right-2026-11-17T17-47-51-393Z.json";
import slideRecording from "../../../../recordings/ghost-recording-android-slide-2026-11-17T17-53-27-552Z.json";
import test01Recording from "../../../../recordings/ghost-recording-android-test-01-2026-11-17T17-19-29-358Z.json";
import tableFlatRecording from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-28-41-306Z.json";
import tableFlatRecording2 from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-31-09-199Z.json";
import tableFlatRecording3 from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-44-05-337Z.json";

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

describe("Spin Detector (Task 3.2)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata and spec defaults", () => {
      expect(spinDetector.name).toBe("spin");
      expect(spinDetector.defaults).toEqual(DEFAULT_SPIN_CONFIG);
      expect(spinDetector.defaults.targetDegrees).toBe(300);
      expect(spinDetector.defaults.windowMs).toBe(1000);
      expect(spinDetector.defaults.cooldownMs).toBe(800);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = spinDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides", () => {
      const custom = createSpinDetector({
        targetDegrees: 360,
        windowMs: 1500,
        cooldownMs: 1000,
      });

      // Feeds 320 degrees of rotation (above default 300, below custom 360)
      // At 400 deg/s for 800 ms = 320 degrees
      const events: ReturnType<typeof custom.push> = [];
      for (let t = 0; t <= 800; t += 40) {
        const evts = custom.push(makeSample({ t, gz: 400 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(0);
    });
  });

  describe("Valid spin detection and directional parity", () => {
    it("detects counter-clockwise spin (direction: -1) when rotating >= 300° (positive gz) within 1.0 second", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // 540 deg/s for 600 ms = 324 degrees rotation in ~0.6 s
      // Samples every 30 ms (approx 33 Hz)
      for (let t = 0; t <= 600; t += 30) {
        const evts = detector.push(makeSample({ t, gz: 540 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("spin");
      expect(e.data!.direction).toBe(SPIN_DIRECTION.COUNTER_CLOCKWISE);
      expect(e.data!.degrees).toBeGreaterThanOrEqual(300);
    });

    it("detects clockwise spin (direction: 1) when rotating <= -300° (negative gz) within 1.0 second", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // -540 deg/s for 600 ms = -324 degrees rotation in ~0.6 s
      for (let t = 0; t <= 600; t += 30) {
        const evts = detector.push(makeSample({ t, gz: -540 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("spin");
      expect(e.data!.direction).toBe(SPIN_DIRECTION.CLOCKWISE);
      expect(e.data!.degrees).toBeGreaterThanOrEqual(300);
    });

    it("detects spin using orientation yaw (alpha) integration when gz is zero", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Rotate alpha from 0 to 320 degrees in steps of 20 degrees every 50 ms (800 ms total)
      for (let step = 0; step <= 16; step++) {
        const t = step * 50;
        const alpha = (step * 20) % 360;
        const evts = detector.push(makeSample({ t, gz: 0, alpha }));
        events.push(...evts);
      }

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("spin");
      expect(e.data!.direction).toBe(SPIN_DIRECTION.COUNTER_CLOCKWISE);
      expect(e.data!.degrees).toBeGreaterThanOrEqual(300);
    });

    it("detects spin with a realistic smooth physical angular velocity curve (half-sine profile)", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Realistic physical spin: human accelerates to peak angular velocity and decelerates to rest.
      // omega(t) = omega_peak * sin(pi * t / T)
      // For T = 700 ms, omega_peak = 700 deg/s:
      // Total rotation = integral_0^T omega(t) dt = (2 * omega_peak * T) / pi = (2 * 700 * 0.7) / pi ~= 312 degrees
      const durationMs = 700;
      const peakOmega = 700;

      for (let t = 0; t <= durationMs; t += 20) {
        const fraction = t / durationMs;
        const gz = peakOmega * Math.sin(fraction * Math.PI);
        events.push(...detector.push(makeSample({ t, gz })));
      }

      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("spin");
      expect(events[0]!.data!.direction).toBe(SPIN_DIRECTION.COUNTER_CLOCKWISE);
      expect(events[0]!.data!.degrees).toBeGreaterThanOrEqual(300);
    });

    it("safely integrates deceleration phase when gz drops to zero without losing trapezoid", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Stream starts with gyro active
      detector.push(makeSample({ t: 0, gz: 600, alpha: 10 }));
      // 500 ms at 600 deg/s = 300°
      for (let t = 50; t <= 500; t += 50) {
        events.push(...detector.push(makeSample({ t, gz: 600, alpha: 10 })));
      }
      // Drops to 0 at t = 550 with sudden compass shift on alpha
      events.push(...detector.push(makeSample({ t: 550, gz: 0, alpha: 180 })));

      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("spin");
      expect(events[0]!.data!.degrees).toBeGreaterThanOrEqual(300);
    });
  });

  describe("Sub-threshold and slow movements that must not count", () => {
    it("does not trigger when total rotation is below 300° (e.g. 250° rotation)", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // 500 deg/s for 500 ms = 250 degrees total, then stop
      for (let t = 0; t <= 500; t += 25) {
        const evts = detector.push(makeSample({ t, gz: 500 }));
        events.push(...evts);
      }
      for (let t = 525; t <= 1000; t += 25) {
        const evts = detector.push(makeSample({ t, gz: 0 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(0);
    });

    it("does not trigger on slow rotation (e.g. 360° over 3 seconds, ~120 deg/s)", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // 120 deg/s for 3000 ms. In any 1000 ms window, rotation is only 120° (< 300°)
      for (let t = 0; t <= 3000; t += 50) {
        const evts = detector.push(makeSample({ t, gz: 120 }));
        events.push(...evts);
      }

      expect(events).toHaveLength(0);
    });

    it("does not trigger on alternating back-and-forth rotation (zero net angular displacement)", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Oscillates +400 deg/s for 200 ms (+80°), then -400 deg/s for 200 ms (-80°)
      for (let cycle = 0; cycle < 5; cycle++) {
        for (let dt = 0; dt < 200; dt += 25) {
          const t = cycle * 400 + dt;
          events.push(...detector.push(makeSample({ t, gz: 400 })));
        }
        for (let dt = 0; dt < 200; dt += 25) {
          const t = cycle * 400 + 200 + dt;
          events.push(...detector.push(makeSample({ t, gz: -400 })));
        }
      }

      expect(events).toHaveLength(0);
    });

    it("does not trigger on +180° rotation followed immediately by -180° rotation", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Forward rotation: +600 deg/s for 300 ms = +180 degrees
      for (let t = 0; t <= 300; t += 25) {
        events.push(...detector.push(makeSample({ t, gz: 600 })));
      }
      // Reverse rotation: -600 deg/s for 300 ms = -180 degrees (back to 0°)
      for (let t = 325; t <= 625; t += 25) {
        events.push(...detector.push(makeSample({ t, gz: -600 })));
      }

      // Despite 360° of total path movement, net rotation within the 1-second window cancels to 0°
      expect(events).toHaveLength(0);
    });
  });

  describe("Duplicate-event prevention and cooldown enforcement", () => {
    it("emits only one spin event during a continuous 720° spin within cooldown", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Continuous spin at 540 deg/s for 1200 ms (~648 degrees)
      for (let t = 0; t <= 1200; t += 30) {
        const evts = detector.push(makeSample({ t, gz: 540 }));
        events.push(...evts);
      }

      // Exactly 1 spin event should be emitted; cooldown (800 ms) suppresses duplicate triggers
      expect(events).toHaveLength(1);
    });

    it("allows a second spin event after cooldown period has elapsed", () => {
      const detector = createSpinDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Spin 1: 0 to 600 ms at 540 deg/s (fires around t = 570)
      for (let t = 0; t <= 600; t += 30) {
        events.push(...detector.push(makeSample({ t, gz: 540 })));
      }
      expect(events).toHaveLength(1);

      // Rest from 600 ms to 1500 ms (> 800 ms cooldown elapsed)
      for (let t = 630; t <= 1500; t += 30) {
        events.push(...detector.push(makeSample({ t, gz: 0 })));
      }

      // Spin 2: 1530 ms to 2200 ms at -540 deg/s (clockwise spin)
      for (let t = 1530; t <= 2200; t += 30) {
        events.push(...detector.push(makeSample({ t, gz: -540 })));
      }

      expect(events).toHaveLength(2);
      expect(events[0]!.data!.direction).toBe(SPIN_DIRECTION.COUNTER_CLOCKWISE);
      expect(events[1]!.data!.direction).toBe(SPIN_DIRECTION.CLOCKWISE);
    });
  });

  describe("Reset behavior and timestamp robustness", () => {
    it("clears accumulated rotation and cooldown immediately on reset()", () => {
      const detector = createSpinDetector();

      // Accumulate 200° (sub-threshold)
      for (let t = 0; t <= 400; t += 40) {
        detector.push(makeSample({ t, gz: 500 }));
      }

      // Call reset()
      detector.reset();

      // Accumulate another 150° (would sum to 350° without reset)
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 500; t <= 800; t += 50) {
        events.push(...detector.push(makeSample({ t, gz: 500 })));
      }

      // 150° after reset is below 300° target => no event
      expect(events).toHaveLength(0);
    });

    it("recovers gracefully and resets state when timestamp moves backward", () => {
      const detector = createSpinDetector();

      detector.push(makeSample({ t: 1000, gz: 500 }));
      // Timestamp jumps back to 0 (recording looped)
      const events = detector.push(makeSample({ t: 0, gz: 500 }));
      expect(events).toHaveLength(0);

      // Now complete a clean 300° spin
      const spinEvents: ReturnType<typeof detector.push> = [];
      for (let t = 30; t <= 630; t += 30) {
        spinEvents.push(...detector.push(makeSample({ t, gz: 540 })));
      }

      expect(spinEvents).toHaveLength(1);
    });

    it("ignores samples with NaN or Infinity without crashing", () => {
      const detector = createSpinDetector();

      expect(detector.push(makeSample({ t: NaN, gz: 500 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 100, gz: Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 110, gz: -Infinity }))).toEqual([]);

      // Clean spin after corrupt samples succeeds
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 200; t <= 800; t += 30) {
        events.push(...detector.push(makeSample({ t, gz: 540 })));
      }
      expect(events).toHaveLength(1);
    });

    it("caps temporal intervals at maxGapMs so large time gaps do not invent rotation", () => {
      const detector = createSpinDetector();
      detector.push(makeSample({ t: 0, gz: 800 }));
      // 60-second jump with high gyro: capped at maxGapMs (100ms) = 80 deg, well below 300 deg
      expect(detector.push(makeSample({ t: 60_000, gz: 800 }))).toEqual([]);
    });
  });

  describe("Real Ghost Recording validation", () => {
    it("never emits a spin on a phone resting flat on a table across multiple recordings", () => {
      for (const rec of [tableFlatRecording, tableFlatRecording2, tableFlatRecording3]) {
        const detector = createSpinDetector();
        const detectedEvents: ReturnType<typeof detector.push> = [];

        for (const sample of rec.samples) {
          detectedEvents.push(...detector.push(sample as Sample));
        }

        expect(detectedEvents).toHaveLength(0);
      }
    });

    it("never emits a spin during non-spin gestures (android-left-right, android-slide, android-test-01)", () => {
      for (const rec of [leftRightRecording, slideRecording, test01Recording]) {
        const detector = createSpinDetector();
        const detectedEvents: ReturnType<typeof detector.push> = [];

        for (const sample of rec.samples) {
          detectedEvents.push(...detector.push(sample as Sample));
        }

        expect(detectedEvents).toHaveLength(0);
      }
    });
  });
});
