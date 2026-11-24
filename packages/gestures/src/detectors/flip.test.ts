import { describe, expect, it } from "vitest";
import type { Sample } from "@haunt-kit/protocol";
import { DEFAULT_FLIP_CONFIG, FLIP_STATE, createFlipDetector, flipDetector } from "./flip";
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

describe("Flip Detector (Task 3.3)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata and spec defaults", () => {
      expect(flipDetector.name).toBe("flip");
      expect(flipDetector.defaults).toEqual(DEFAULT_FLIP_CONFIG);
      expect(flipDetector.defaults.faceDownThreshold).toBe(-7.0);
      expect(flipDetector.defaults.holdMs).toBe(200);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = flipDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides", () => {
      const custom = createFlipDetector({
        faceDownThreshold: -8.5,
        holdMs: 300,
      });

      // Feeds az = -8.0 m/s² for 400 ms:
      // Below default -7.0, but NOT below custom -8.5 => should NOT trigger
      const events: ReturnType<typeof custom.push> = [];
      for (let t = 0; t <= 400; t += 50) {
        events.push(...custom.push(makeSample({ t, az: -8.0 })));
      }
      expect(events).toHaveLength(0);

      // Now feed az = -9.0 m/s² (below -8.5) for 350 ms (>= 300 ms hold)
      for (let t = 450; t <= 800; t += 50) {
        events.push(...custom.push(makeSample({ t, az: -9.0 })));
      }
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("flip");
      expect(events[0]!.data!.faceDown).toBe(FLIP_STATE.FACE_DOWN);
    });
  });

  describe("Valid flip and flip-back detection", () => {
    it("fires flip with faceDown: 1 when az < -7.0 m/s² and holds for 200 ms", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Start face-up (az = +9.81)
      events.push(...detector.push(makeSample({ t: 0, az: 9.81 })));
      expect(events).toHaveLength(0);

      // Flip face-down (az = -9.81 m/s²) and hold for 250 ms (samples every 50 ms)
      for (let t = 50; t <= 300; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      // Exactly 1 flip event emitted once 200 ms threshold is reached (at t = 250)
      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("flip");
      expect(e.t).toBe(250);
      expect(e.data!.faceDown).toBe(1);
      expect(e.data!.faceDown).toBe(FLIP_STATE.FACE_DOWN);
    });

    it("fires flip with faceDown: 0 when flipped back to face-up", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Flip face-down for 250 ms
      for (let t = 0; t <= 250; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }
      expect(events).toHaveLength(1);
      expect(events[0]!.data!.faceDown).toBe(1);

      // Now flip phone back to face-up (az = +9.81)
      for (let t = 300; t <= 500; t += 50) {
        events.push(...detector.push(makeSample({ t, az: 9.81 })));
      }

      expect(events).toHaveLength(2);
      const flipBackEvent = events[1]!;
      expect(flipBackEvent.name).toBe("flip");
      expect(flipBackEvent.t).toBe(500);
      expect(flipBackEvent.data!.faceDown).toBe(0);
      expect(flipBackEvent.data!.faceDown).toBe(FLIP_STATE.FACE_UP);
    });

    it("handles multiple continuous flip and flip-back cycles", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      let t = 0;
      for (let cycle = 0; cycle < 3; cycle++) {
        // Face down for 250 ms
        for (let dt = 0; dt <= 250; dt += 50) {
          t += 50;
          events.push(...detector.push(makeSample({ t, az: -9.81 })));
        }
        // Face up for 250 ms
        for (let dt = 0; dt <= 250; dt += 50) {
          t += 50;
          events.push(...detector.push(makeSample({ t, az: 9.81 })));
        }
      }

      // 3 cycles => 3 faceDown: 1 events and 3 faceDown: 0 events = 6 events total
      expect(events).toHaveLength(6);
      expect(events[0]!.data!.faceDown).toBe(1);
      expect(events[1]!.data!.faceDown).toBe(0);
      expect(events[2]!.data!.faceDown).toBe(1);
      expect(events[3]!.data!.faceDown).toBe(0);
      expect(events[4]!.data!.faceDown).toBe(1);
      expect(events[5]!.data!.faceDown).toBe(0);
    });
  });

  describe("Sub-threshold, incomplete and slow movements", () => {
    it("does not trigger when az is tilted but not below faceDownThreshold (e.g. az = -5.0 m/s²)", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Held at az = -5.0 m/s² for 1000 ms (> -7.0)
      for (let t = 0; t <= 1000; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -5.0 })));
      }

      expect(events).toHaveLength(0);
    });

    it("does not trigger when turned face-down for less than holdMs (e.g. 150 ms)", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Turns face down at t = 100
      events.push(...detector.push(makeSample({ t: 100, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 150, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 250, az: -9.81 }))); // elapsed = 150 ms (< 200 ms)

      // Turns back face up at t = 280 before 200 ms completes
      events.push(...detector.push(makeSample({ t: 280, az: 5.0 })));
      events.push(...detector.push(makeSample({ t: 350, az: 9.81 })));

      expect(events).toHaveLength(0);
    });

    it("resets hold timer completely on interruption and requires a fresh continuous 200 ms", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Phase 1: az < -7.0 for 150 ms (t = 100 to 250)
      events.push(...detector.push(makeSample({ t: 100, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 200, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 250, az: -9.81 })));
      expect(events).toHaveLength(0);

      // Interruption: az rises above -7.0 at t = 300
      events.push(...detector.push(makeSample({ t: 300, az: 0 })));
      expect(events).toHaveLength(0);

      // Phase 2: az drops below -7.0 again at t = 400 for only 100 ms (t = 400 to 500)
      // If timer had not reset, 150 + 100 = 250 ms would falsely trigger
      events.push(...detector.push(makeSample({ t: 400, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 450, az: -9.81 })));
      events.push(...detector.push(makeSample({ t: 500, az: -9.81 })));
      expect(events).toHaveLength(0);

      // Continue Phase 2 for another 100 ms (t = 600, reaching continuous 200 ms from t = 400)
      events.push(...detector.push(makeSample({ t: 600, az: -9.81 })));
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("flip");
      expect(events[0]!.t).toBe(600);
      expect(events[0]!.data!.faceDown).toBe(1);
    });

    it("does not trigger on momentary high-impulse spikes or vibrations (< 200 ms)", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Phone is face up
      events.push(...detector.push(makeSample({ t: 0, az: 9.81 })));

      // Sudden shake impulse drives az down to -12 m/s² for only 40 ms
      events.push(...detector.push(makeSample({ t: 50, az: -12.0 })));
      events.push(...detector.push(makeSample({ t: 90, az: -10.0 })));
      events.push(...detector.push(makeSample({ t: 120, az: 4.0 })));
      events.push(...detector.push(makeSample({ t: 150, az: 9.81 })));

      expect(events).toHaveLength(0);
    });

    it("detects flip following a slow, gradual rotation once held face-down for 200 ms", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Gradual rotation from +9.81 to -9.81 over 1000 ms
      for (let t = 0; t <= 1000; t += 50) {
        const fraction = t / 1000;
        const az = 9.81 - fraction * 19.62; // moves from +9.81 to -9.81
        events.push(...detector.push(makeSample({ t, az })));
      }

      // Now holds at -9.81 m/s² for another 300 ms
      for (let t = 1050; t <= 1350; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("flip");
      expect(events[0]!.data!.faceDown).toBe(1);
    });
  });

  describe("Duplicate-event prevention and debouncing", () => {
    it("emits only one faceDown: 1 event during a continuous 2-second face-down hold", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Continuous face-down for 2000 ms
      for (let t = 0; t <= 2000; t += 30) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      // Exactly 1 event emitted
      expect(events).toHaveLength(1);
      expect(events[0]!.data!.faceDown).toBe(1);
    });

    it("emits only one faceDown: 0 event during a continuous face-up hold after flip-back", () => {
      const detector = createFlipDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Face down for 300 ms
      for (let t = 0; t <= 300; t += 30) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }
      expect(events).toHaveLength(1);

      // Flip back and stay face up for 2000 ms
      for (let t = 330; t <= 2330; t += 30) {
        events.push(...detector.push(makeSample({ t, az: 9.81 })));
      }

      // Only 1 additional event (faceDown: 0)
      expect(events).toHaveLength(2);
      expect(events[1]!.data!.faceDown).toBe(0);
    });
  });

  describe("Reset behavior and timestamp robustness", () => {
    it("clears face-down state immediately on reset()", () => {
      const detector = createFlipDetector();

      // Confirm face down
      for (let t = 0; t <= 300; t += 50) {
        detector.push(makeSample({ t, az: -9.81 }));
      }

      // Reset
      detector.reset();

      // Subsequent samples at face-up should NOT emit faceDown: 0 because state was reset
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 350; t <= 600; t += 50) {
        events.push(...detector.push(makeSample({ t, az: 9.81 })));
      }

      expect(events).toHaveLength(0);
    });

    it("clears pending hold timer on reset()", () => {
      const detector = createFlipDetector();

      // Held face-down for 150 ms (pending hold)
      for (let t = 0; t <= 150; t += 50) {
        detector.push(makeSample({ t, az: -9.81 }));
      }

      // Reset
      detector.reset();

      // Another 100 ms at face-down (would have exceeded 200 ms if not reset)
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 200; t <= 300; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      // 100 ms < 200 ms => no event
      expect(events).toHaveLength(0);
    });

    it("resets state when timestamp moves backward", () => {
      const detector = createFlipDetector();

      // Held face-down for 300 ms
      for (let t = 0; t <= 300; t += 50) {
        detector.push(makeSample({ t, az: -9.81 }));
      }

      // Backward jump (t = 0)
      const jumpEvents = detector.push(makeSample({ t: 0, az: 9.81 }));
      expect(jumpEvents).toHaveLength(0);

      // Now new face-down hold starting at t = 100
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 100; t <= 350; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.faceDown).toBe(1);
    });

    it("ignores non-finite az or t values safely without crashing", () => {
      const detector = createFlipDetector();

      expect(detector.push(makeSample({ t: NaN, az: -9.81 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 100, az: NaN }))).toEqual([]);
      expect(detector.push(makeSample({ t: 150, az: -Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 200, az: Infinity }))).toEqual([]);

      // Valid samples afterwards operate cleanly
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 300; t <= 550; t += 50) {
        events.push(...detector.push(makeSample({ t, az: -9.81 })));
      }

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.faceDown).toBe(1);
    });
  });

  describe("Real Ghost Recording validation", () => {
    it("never emits flip on a phone resting flat on a table (face-up baseline)", () => {
      for (const rec of [tableFlatRecording, tableFlatRecording2, tableFlatRecording3]) {
        const detector = createFlipDetector();
        const detectedEvents: ReturnType<typeof detector.push> = [];

        for (const sample of rec.samples) {
          detectedEvents.push(...detector.push(sample as Sample));
        }

        // Table-flat recordings are face-up with az ~ +9.8 m/s² => zero flip events
        expect(detectedEvents).toHaveLength(0);
      }
    });

    it("never emits flip during non-flip movement (android-left-right, android-slide, android-test-01)", () => {
      for (const rec of [leftRightRecording, slideRecording, test01Recording]) {
        const detector = createFlipDetector();
        const detectedEvents: ReturnType<typeof detector.push> = [];

        for (const sample of rec.samples) {
          detectedEvents.push(...detector.push(sample as Sample));
        }

        // Linear gestures and slides stay face-up => zero flip events
        expect(detectedEvents).toHaveLength(0);
      }
    });
  });
});
