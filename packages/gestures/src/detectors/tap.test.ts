import { describe, expect, it } from "vitest";
import type { Sample } from "@haunt-kit/protocol";
import { DEFAULT_TAP_CONFIG, createTapDetector, tapDetector, type TapSample } from "./tap";
import leftRightRecording from "../../../../recordings/ghost-recording-android-left-right-2026-11-17T17-47-51-393Z.json";
import tableFlatRecording from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-28-41-306Z.json";

function makeSample(overrides: Partial<TapSample> = {}): TapSample {
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

describe("Tap Detector (Task 3.5)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata and spec defaults", () => {
      expect(tapDetector.name).toBe("tap");
      expect(tapDetector.defaults).toEqual(DEFAULT_TAP_CONFIG);
      expect(tapDetector.defaults.minIntervalMs).toBe(0);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = tapDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides for debouncing", () => {
      const custom = createTapDetector({ minIntervalMs: 100 });

      const events: ReturnType<typeof custom.push> = [];
      // First tap at t = 100
      events.push(...custom.push(makeSample({ t: 100, x: 0.5, y: 0.5 })));
      expect(events).toHaveLength(1);

      // Rapid bounce tap at t = 150 (< 100 ms interval)
      events.push(...custom.push(makeSample({ t: 150, x: 0.5, y: 0.5 })));
      expect(events).toHaveLength(1);

      // Second legitimate tap at t = 220 (>= 100 ms interval)
      events.push(...custom.push(makeSample({ t: 220, x: 0.8, y: 0.2 })));
      expect(events).toHaveLength(2);
      expect(events[1]!.data!.x).toBe(0.8);
    });
  });

  describe("Valid tap detection and coordinate extraction", () => {
    it("fires a tap event with normalized screen coordinates (x, y)", () => {
      const detector = createTapDetector();
      const events = detector.push(makeSample({ t: 250, x: 0.42, y: 0.88 }));

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("tap");
      expect(e.t).toBe(250);
      expect(e.data!.x).toBe(0.42);
      expect(e.data!.y).toBe(0.88);
    });

    it("extracts coordinates from nested touch or tap payloads", () => {
      const detector = createTapDetector();

      // Nested touch object
      const events1 = detector.push(makeSample({ t: 300, touch: { x: 0.15, y: 0.65 } }));
      expect(events1).toHaveLength(1);
      expect(events1[0]!.data!.x).toBe(0.15);
      expect(events1[0]!.data!.y).toBe(0.65);

      // Nested tap object
      const events2 = detector.push(makeSample({ t: 400, tap: { x: 0.7, y: 0.3 } }));
      expect(events2).toHaveLength(1);
      expect(events2[0]!.data!.x).toBe(0.7);
      expect(events2[0]!.data!.y).toBe(0.3);
    });

    it("emits multiple consecutive taps when multiple touch events arrive", () => {
      const detector = createTapDetector();
      const events: ReturnType<typeof detector.push> = [];

      events.push(...detector.push(makeSample({ t: 100, x: 0.1, y: 0.2 })));
      events.push(...detector.push(makeSample({ t: 200, x: 0.3, y: 0.4 })));
      events.push(...detector.push(makeSample({ t: 300, x: 0.5, y: 0.6 })));

      expect(events).toHaveLength(3);
      expect(events[0]!.data!.x).toBe(0.1);
      expect(events[1]!.data!.x).toBe(0.3);
      expect(events[2]!.data!.x).toBe(0.5);
    });
  });

  describe("Coordinate boundaries and normalization", () => {
    it("handles exact boundary coordinates [0, 0] and [1, 1]", () => {
      const detector = createTapDetector();

      const e1 = detector.push(makeSample({ t: 100, x: 0, y: 0 }));
      expect(e1).toHaveLength(1);
      expect(e1[0]!.data!.x).toBe(0);
      expect(e1[0]!.data!.y).toBe(0);

      const e2 = detector.push(makeSample({ t: 200, x: 1, y: 1 }));
      expect(e2).toHaveLength(1);
      expect(e2[0]!.data!.x).toBe(1);
      expect(e2[0]!.data!.y).toBe(1);
    });

    it("clamps out-of-bounds coordinates to [0, 1] range", () => {
      const detector = createTapDetector();

      // Coordinates beyond boundaries (e.g. browser margin / gesture overshoot)
      const e1 = detector.push(makeSample({ t: 100, x: -0.25, y: 1.5 }));
      expect(e1).toHaveLength(1);
      expect(e1[0]!.data!.x).toBe(0);
      expect(e1[0]!.data!.y).toBe(1);

      const e2 = detector.push(makeSample({ t: 200, x: 2.0, y: -0.8 }));
      expect(e2).toHaveLength(1);
      expect(e2[0]!.data!.x).toBe(1);
      expect(e2[0]!.data!.y).toBe(0);
    });
  });

  describe("Missing and invalid coordinate handling", () => {
    it("does not emit tap when coordinates are missing (regular sensor samples)", () => {
      const detector = createTapDetector();

      // Pure motion samples without touch data
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 0; t <= 500; t += 50) {
        events.push(...detector.push(makeSample({ t, ax: 0, ay: 0, az: 9.81 })));
      }

      expect(events).toHaveLength(0);
    });

    it("does not emit tap when only one coordinate is provided", () => {
      const detector = createTapDetector();

      expect(detector.push(makeSample({ t: 100, x: 0.5 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 200, y: 0.5 }))).toEqual([]);
    });

    it("does not emit tap when coordinates are non-finite (NaN, Infinity)", () => {
      const detector = createTapDetector();

      expect(detector.push(makeSample({ t: 100, x: NaN, y: 0.5 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 150, x: 0.5, y: NaN }))).toEqual([]);
      expect(detector.push(makeSample({ t: 200, x: Infinity, y: 0.5 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 250, x: 0.5, y: -Infinity }))).toEqual([]);
    });

    it("safely handles non-finite timestamps", () => {
      const detector = createTapDetector();

      expect(detector.push(makeSample({ t: NaN, x: 0.5, y: 0.5 }))).toEqual([]);
      expect(detector.push(makeSample({ t: Infinity, x: 0.5, y: 0.5 }))).toEqual([]);
    });
  });

  describe("Reset behavior and timestamp robustness", () => {
    it("resets state and cooldown timer on reset()", () => {
      const detector = createTapDetector({ minIntervalMs: 500 });

      // First tap at t = 100
      expect(detector.push(makeSample({ t: 100, x: 0.5, y: 0.5 }))).toHaveLength(1);

      // Calling reset() clears the lastEventTime
      detector.reset();

      // Second tap at t = 150 (would normally be suppressed by 500 ms minInterval)
      const events = detector.push(makeSample({ t: 150, x: 0.8, y: 0.8 }));
      expect(events).toHaveLength(1);
      expect(events[0]!.data!.x).toBe(0.8);
    });

    it("resets state when timestamp moves backward", () => {
      const detector = createTapDetector({ minIntervalMs: 500 });

      expect(detector.push(makeSample({ t: 1000, x: 0.5, y: 0.5 }))).toHaveLength(1);

      // Timestamp jumps back to 0 (recording looped)
      expect(detector.push(makeSample({ t: 0, x: 0.2, y: 0.2 }))).toHaveLength(1);
    });
  });

  describe("Real Ghost Recording validation", () => {
    it("never emits tap on real motion Ghost Recordings (recordings contain no touch data)", () => {
      for (const rec of [tableFlatRecording, leftRightRecording]) {
        const detector = createTapDetector();
        const detectedEvents: ReturnType<typeof detector.push> = [];

        for (const sample of rec.samples) {
          detectedEvents.push(...detector.push(sample as Sample));
        }

        expect(detectedEvents).toHaveLength(0);
      }
    });
  });
});
