import { describe, expect, it } from "vitest";
import type { Sample } from "@haunt-kit/protocol";
import { DEFAULT_SCREAM_CONFIG, createScreamDetector, screamDetector } from "./scream";

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

describe("Scream Detector (Task 3.4)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata and spec defaults", () => {
      expect(screamDetector.name).toBe("scream");
      expect(screamDetector.defaults).toEqual(DEFAULT_SCREAM_CONFIG);
      expect(screamDetector.defaults.rmsThreshold).toBe(0.65);
      expect(screamDetector.defaults.minDurationMs).toBe(300);
      expect(screamDetector.defaults.cooldownMs).toBe(1000);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = screamDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides", () => {
      const custom = createScreamDetector({
        rmsThreshold: 0.8,
        minDurationMs: 500,
        cooldownMs: 2000,
      });

      // Feeds rms = 0.75 (above default 0.65, below custom 0.8) for 600 ms
      const events: ReturnType<typeof custom.push> = [];
      for (let t = 0; t <= 600; t += 50) {
        events.push(...custom.push(makeSample({ t, rms: 0.75 })));
      }
      expect(events).toHaveLength(0);

      // Feeds rms = 0.85 (above 0.8) for 550 ms (>= 500 ms)
      for (let t = 650; t <= 1200; t += 50) {
        events.push(...custom.push(makeSample({ t, rms: 0.85 })));
      }
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe("scream");
    });
  });

  describe("Valid scream detection and calculations", () => {
    it("detects a valid scream lasting at least 300 ms", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Start with quiet samples (rms = 0.05)
      events.push(...detector.push(makeSample({ t: 0, rms: 0.05 })));
      events.push(...detector.push(makeSample({ t: 50, rms: 0.05 })));
      expect(events).toHaveLength(0);

      // Scream starts at t = 100 with rms = 0.80 and holds for 350 ms (up to t = 450)
      for (let t = 100; t <= 450; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.8 })));
      }

      // Reaches 300 ms duration at t = 400 (from 100 to 400 = 300 ms)
      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.name).toBe("scream");
      expect(e.t).toBe(400);
      expect(e.data!.peak).toBe(0.8);
      expect(e.data!.average).toBeCloseTo(0.8, 5);
    });

    it("correctly calculates peak and average values over the qualifying window", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Feeds variable rms values above threshold (0.65):
      // t = 0: 0.70
      // t = 50: 0.75
      // t = 100: 0.90 (peak)
      // t = 150: 0.85
      // t = 200: 0.80
      // t = 250: 0.75
      // t = 300: 0.70 (duration = 300 ms)
      // Values: [0.70, 0.75, 0.90, 0.85, 0.80, 0.75, 0.70]
      // Sum = 5.45, Count = 7, Avg = 5.45 / 7 ~= 0.77857
      const rmsSeries = [0.7, 0.75, 0.9, 0.85, 0.8, 0.75, 0.7];
      for (let i = 0; i < rmsSeries.length; i++) {
        const t = i * 50;
        const evts = detector.push(makeSample({ t, rms: rmsSeries[i] }));
        events.push(...evts);
      }

      expect(events).toHaveLength(1);
      const e = events[0]!;
      expect(e.data!.peak).toBe(0.9);
      expect(e.data!.average).toBeCloseTo(237.5 / 300, 4);
    });
  });

  describe("Sub-threshold, incomplete and interrupted loudness", () => {
    it("does not trigger when loudness stays below threshold (e.g. ambient chatter rms = 0.50)", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // 0.50 is below 0.65 threshold
      for (let t = 0; t <= 1000; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.5 })));
      }

      expect(events).toHaveLength(0);
    });

    it("resets active window and does not trigger if loudness drops below threshold before 300 ms", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Loud burst for 200 ms (t = 100 to 300)
      events.push(...detector.push(makeSample({ t: 100, rms: 0.85 })));
      events.push(...detector.push(makeSample({ t: 200, rms: 0.85 })));
      events.push(...detector.push(makeSample({ t: 300, rms: 0.85 }))); // duration = 200 ms (< 300 ms)
      expect(events).toHaveLength(0);

      // Drops below threshold at t = 350
      events.push(...detector.push(makeSample({ t: 350, rms: 0.4 })));
      expect(events).toHaveLength(0);

      // Subsequent loud burst for only 150 ms (t = 400 to 550)
      // If window had not reset, 200 + 150 = 350 ms would have triggered
      events.push(...detector.push(makeSample({ t: 400, rms: 0.85 })));
      events.push(...detector.push(makeSample({ t: 500, rms: 0.85 })));
      events.push(...detector.push(makeSample({ t: 550, rms: 0.85 })));
      expect(events).toHaveLength(0);

      // Loudness must sustain for fresh continuous 300 ms to trigger (t = 600)
      events.push(...detector.push(makeSample({ t: 600, rms: 0.85 })));
      events.push(...detector.push(makeSample({ t: 700, rms: 0.85 }))); // t = 400 to 700 = 300 ms
      expect(events).toHaveLength(1);
      expect(events[0]!.t).toBe(700);
    });
  });

  describe("Sustained loudness and cooldown duplicate prevention", () => {
    it("emits only one scream event during a continuous 1200 ms sustained scream within cooldown", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Continuous loud scream at rms = 0.90 for 1200 ms
      for (let t = 0; t <= 1200; t += 30) {
        events.push(...detector.push(makeSample({ t, rms: 0.9 })));
      }

      // Exactly 1 scream event should be emitted; cooldown (1000 ms) prevents duplicate triggers
      expect(events).toHaveLength(1);
    });

    it("suppresses screams that occur within the 1000 ms cooldown period", () => {
      const detector = createScreamDetector();
      const events: ReturnType<typeof detector.push> = [];

      // Scream 1: t = 0 to 350 ms (fires at t = 300)
      for (let t = 0; t <= 350; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }
      expect(events).toHaveLength(1);
      expect(events[0]!.t).toBe(300);

      // Silence from t = 400 to 550
      events.push(...detector.push(makeSample({ t: 400, rms: 0.1 })));
      events.push(...detector.push(makeSample({ t: 500, rms: 0.1 })));

      // Scream 2 attempt: t = 600 to 950 ms (duration = 350 ms >= 300 ms)
      // But elapsed since last event: 900 - 300 = 600 ms (< 1000 ms cooldown)
      for (let t = 600; t <= 950; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }
      // Should NOT fire second event
      expect(events).toHaveLength(1);

      // Silence until cooldown passes (> 1000 ms from t = 300, e.g. t = 1400)
      for (let t = 1000; t <= 1400; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.1 })));
      }

      // Scream 3 attempt: t = 1500 to 1850 ms (duration >= 300 ms, elapsed > 1000 ms)
      for (let t = 1500; t <= 1850; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }

      expect(events).toHaveLength(2);
      expect(events[1]!.t).toBe(1800);
    });
  });

  describe("Reset behavior and edge cases", () => {
    it("clears active window and cooldown immediately on reset()", () => {
      const detector = createScreamDetector();

      // Accumulate 200 ms of loudness
      for (let t = 0; t <= 200; t += 50) {
        detector.push(makeSample({ t, rms: 0.85 }));
      }

      // Reset
      detector.reset();

      // Accumulate another 150 ms of loudness (would sum to 350 ms without reset)
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 250; t <= 400; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }

      expect(events).toHaveLength(0);
    });

    it("resets state when timestamp moves backward", () => {
      const detector = createScreamDetector();

      // Feeds scream at t = 1000
      detector.push(makeSample({ t: 1000, rms: 0.85 }));

      // Backward timestamp jump to t = 0 (recording loop)
      const events = detector.push(makeSample({ t: 0, rms: 0.85 }));
      expect(events).toHaveLength(0);

      // New clean 300 ms scream
      const screamEvents: ReturnType<typeof detector.push> = [];
      for (let t = 50; t <= 350; t += 50) {
        screamEvents.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }

      expect(screamEvents).toHaveLength(1);
    });

    it("handles missing rms (undefined) and non-finite values safely", () => {
      const detector = createScreamDetector();

      // Missing rms property
      expect(detector.push(makeSample({ t: 100 }))).toEqual([]);

      // Non-finite values
      expect(detector.push(makeSample({ t: 150, rms: NaN }))).toEqual([]);
      expect(detector.push(makeSample({ t: 200, rms: Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 250, rms: -Infinity }))).toEqual([]);

      // Invalid timestamp
      expect(detector.push(makeSample({ t: NaN, rms: 0.9 }))).toEqual([]);

      // Clean scream afterwards operates normally
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 300; t <= 650; t += 50) {
        events.push(...detector.push(makeSample({ t, rms: 0.85 })));
      }

      expect(events).toHaveLength(1);
    });
  });
});
