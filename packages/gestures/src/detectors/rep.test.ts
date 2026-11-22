import { describe, expect, it } from "vitest";
import type { GestureEvent, Sample } from "@haunt-kit/protocol";
import { DEFAULT_REP_CONFIG, type RepConfig, createRepDetector, repDetector } from "./rep";
import tableFlatRecording from "../../../../recordings/ghost-recording-table-flat-2026-11-17T17-28-41-306Z.json";

function makeSample(overrides: Partial<Sample> = {}): Sample {
  const beta = overrides.beta ?? 0;
  const gamma = overrides.gamma ?? 0;
  const betaRad = (beta * Math.PI) / 180;
  const gammaRad = (gamma * Math.PI) / 180;
  const defaultAy = -9.81 * Math.sin(betaRad);
  const defaultAx = 9.81 * Math.sin(gammaRad);
  const defaultAz = 9.81 * Math.cos(betaRad) * Math.cos(gammaRad);

  return {
    t: 100,
    ax: defaultAx,
    ay: defaultAy,
    az: defaultAz,
    gx: 0,
    gy: 0,
    gz: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    ...overrides,
  };
}

/**
 * Creates a calibrated rep detector for fast unit testing by defaulting calibrationMs: 0
 * and targetRomDeg: 45.
 */
function createTestDetector(customConfig?: Partial<RepConfig>) {
  return createRepDetector({
    calibrationMs: 0,
    targetRomDeg: 45,
    ...customConfig,
  });
}

/**
 * Generates a clean synthetic exercise movement cycle from 0° up to peakDeg and back down to 0°.
 */
function generateRepSamples(startT: number, durationMs: number, peakDeg: number, stepMs = 50): Sample[] {
  const samples: Sample[] = [];
  const steps = Math.floor(durationMs / stepMs);

  for (let i = 0; i <= steps; i++) {
    const t = startT + i * stepMs;
    const progress = i / steps; // 0 to 1
    // Half-sine profile: 0 -> peakDeg -> 0
    const angle = peakDeg * Math.sin(progress * Math.PI);
    // Convert angle to gravitational inclination (pitching around beta)
    const rad = (angle * Math.PI) / 180;
    const ay = -9.81 * Math.sin(rad);
    const az = 9.81 * Math.cos(rad);

    samples.push(
      makeSample({
        t,
        ax: 0,
        ay,
        az,
        beta: angle,
        gamma: 0,
      }),
    );
  }

  return samples;
}

describe("Steady Rep Detector (Task 4.1)", () => {
  describe("Detector contract and default configuration", () => {
    it("conforms to the Detector contract metadata and spec defaults", () => {
      expect(repDetector.name).toBe("rep");
      expect(repDetector.defaults).toMatchObject(DEFAULT_REP_CONFIG);
      expect(repDetector.defaults.minRomDeg).toBe(45);
      expect(repDetector.defaults.targetRomDeg).toBe(70);
      expect(repDetector.defaults.hysteresisDeg).toBe(10);
      expect(repDetector.defaults.minTempoSec).toBe(1.2);
      expect(repDetector.defaults.calibrationMs).toBe(2000);
      expect(repDetector.defaults.smoothingMs).toBe(100);
    });

    it("creates an independent detector instance via create()", () => {
      const instance = repDetector.create();
      expect(typeof instance.push).toBe("function");
      expect(typeof instance.reset).toBe("function");
    });

    it("respects custom configuration overrides", () => {
      const custom = createTestDetector({
        minRomDeg: 60,
        targetRomDeg: 60,
        hysteresisDeg: 15,
        minTempoSec: 2.0,
      });

      // Calibrate baseline
      custom.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Rep of 50° (above default 45°, but below custom 60°)
      const samples = generateRepSamples(50, 2500, 50, 50);
      const events: ReturnType<typeof custom.push> = [];
      for (const s of samples) {
        events.push(...custom.push(s));
      }

      // Because 50° < custom 60°, no rep is emitted and count remains 0
      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(0);
      expect(custom.status().count).toBe(0);
    });
  });

  describe("Calibration, rep-calibrated event, and status()", () => {
    it("calibrates after 2s of stillness and emits rep-calibrated", () => {
      const detector = createRepDetector();
      const events: GestureEvent[] = [];

      for (let t = 0; t <= 2000; t += 50) {
        events.push(...detector.push(makeSample({ t, ax: 0, ay: 0, az: 9.81 })));
      }

      const calEvents = events.filter((e) => e.name === "rep-calibrated");
      expect(calEvents).toHaveLength(1);
      expect(calEvents[0]!.t).toBe(2000);
      expect(detector.status().calibrated).toBe(true);
      expect(detector.status().calibration).toBe(1);
    });

    it("reports live status including calibration progress, angle, count, and moving flag", () => {
      const detector = createRepDetector();
      expect(detector.status()).toEqual({
        calibrated: false,
        calibration: 0,
        angleDeg: 0,
        moving: false,
        count: 0,
      });

      // Calibrate halfway (1000ms out of 2000ms)
      for (let t = 0; t <= 1000; t += 50) {
        detector.push(makeSample({ t, ax: 0, ay: 0, az: 9.81 }));
      }
      expect(detector.status().calibrated).toBe(false);
      expect(detector.status().calibration).toBeCloseTo(0.5, 1);

      // Finish calibration
      for (let t = 1050; t <= 2000; t += 50) {
        detector.push(makeSample({ t, ax: 0, ay: 0, az: 9.81 }));
      }
      expect(detector.status().calibrated).toBe(true);
      expect(detector.status().calibration).toBe(1);
    });

    it("distinguishes fullRange: 1 (>= targetRomDeg) from fullRange: 0 (< targetRomDeg)", () => {
      const detector = createTestDetector({ targetRomDeg: 70, minRomDeg: 45, smoothingMs: 30 });
      detector.push(makeSample({ t: 0, beta: 0 }));

      // 55° rep: meets minRom (45) but below targetRom (70) => fullRange: 0
      const partialSamples = generateRepSamples(50, 1500, 55, 50);
      const partialEvents = partialSamples.flatMap((s) => detector.push(s)).filter((e) => e.name === "rep");
      expect(partialEvents).toHaveLength(1);
      expect(partialEvents[0]!.data!.count).toBe(1);
      expect(partialEvents[0]!.data!.fullRange).toBe(0);

      // Brief rest
      for (let t = 1600; t <= 1800; t += 50) detector.push(makeSample({ t, beta: 0 }));

      // 75° rep: meets targetRom (70) => fullRange: 1
      const fullSamples = generateRepSamples(1850, 1500, 75, 50);
      const fullEvents = fullSamples.flatMap((s) => detector.push(s)).filter((e) => e.name === "rep");
      expect(fullEvents).toHaveLength(1);
      expect(fullEvents[0]!.data!.count).toBe(2);
      expect(fullEvents[0]!.data!.fullRange).toBe(1);
    });
  });

  describe("1. Complete valid repetition", () => {
    it("detects a complete full-range repetition meeting ROM and tempo requirements", () => {
      const detector = createTestDetector({ smoothingMs: 50 });
      const events: ReturnType<typeof detector.push> = [];

      // Calibrate baseline at rest
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Perform a full repetition: 0° -> 60° -> 0° over 2000 ms (>= 1.2s tempo)
      const samples = generateRepSamples(50, 2000, 60, 50);
      for (const s of samples) {
        events.push(...detector.push(s));
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      const e = repEvents[0]!;
      expect(e.data!.count).toBe(1);
      expect(e.data!.fullRange).toBe(1);
      expect(e.data!.tooFast).toBe(0);
      expect(e.data!.romDeg).toBeGreaterThanOrEqual(45);
      expect(e.data!.tempoSec).toBeGreaterThanOrEqual(1.2);
    });
  });

  describe("2. Correct repetition count across multiple repetitions", () => {
    it("increments repetition count sequentially across multiple reps", () => {
      const detector = createTestDetector({ smoothingMs: 50 });
      const events: ReturnType<typeof detector.push> = [];

      // Calibrate baseline
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      let currentT = 50;
      for (let rep = 1; rep <= 3; rep++) {
        const samples = generateRepSamples(currentT, 1500, 55, 50);
        for (const s of samples) {
          events.push(...detector.push(s));
        }
        currentT += 1700; // brief rest between reps
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(3);
      expect(repEvents[0]!.data!.count).toBe(1);
      expect(repEvents[0]!.data!.fullRange).toBe(1);

      expect(repEvents[1]!.data!.count).toBe(2);
      expect(repEvents[1]!.data!.fullRange).toBe(1);

      expect(repEvents[2]!.data!.count).toBe(3);
      expect(repEvents[2]!.data!.fullRange).toBe(1);
    });
  });

  describe("3. Partial movement that should not count", () => {
    it("does not increment repetition count for movements below minRomDeg", () => {
      const detector = createTestDetector({ smoothingMs: 50 });
      const events: ReturnType<typeof detector.push> = [];

      // Calibrate baseline
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Partial movement: peaks at 30° (< 45° minRomDeg) over 1500 ms
      const partialSamples = generateRepSamples(50, 1500, 30, 50);
      for (const s of partialSamples) {
        events.push(...detector.push(s));
      }

      // Movement below minRomDeg does not emit a rep event
      expect(events.filter((e) => e.name === "rep")).toHaveLength(0);
      expect(detector.status().count).toBe(0);

      // Now perform a full-range rep (60°)
      const fullSamples = generateRepSamples(1600, 1500, 60, 50);
      for (const s of fullSamples) {
        events.push(...detector.push(s));
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.fullRange).toBe(1);
      expect(repEvents[0]!.data!.count).toBe(1); // first counted full rep
    });
  });

  describe("4. Range-of-motion calculations", () => {
    it("accurately records peak range of motion in romDeg", () => {
      const detector = createTestDetector({ smoothingMs: 30 });
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Rep peaking at 70°
      const samples = generateRepSamples(50, 2000, 70, 50);
      const events = samples.flatMap((s) => detector.push(s)).filter((e) => e.name === "rep");

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.romDeg).toBeCloseTo(70, 0);
    });
  });

  describe("5. Tempo calculations and too-fast flag", () => {
    it("flags tooFast: 1 when rep tempo is below minTempoSec (e.g. 0.8s < 1.2s)", () => {
      const detector = createTestDetector({ smoothingMs: 30 });
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Very fast rep completed in 700 ms (< 1200 ms)
      const fastSamples = generateRepSamples(50, 700, 55, 35);
      const events = fastSamples.flatMap((s) => detector.push(s)).filter((e) => e.name === "rep");

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.fullRange).toBe(1);
      expect(events[0]!.data!.tooFast).toBe(1);
      expect(events[0]!.data!.tempoSec).toBeLessThan(1.2);
    });

    it("flags tooFast: 0 when rep tempo meets minTempoSec (e.g. 1.8s >= 1.2s)", () => {
      const detector = createTestDetector({ smoothingMs: 30 });
      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      const slowSamples = generateRepSamples(50, 1800, 55, 50);
      const events = slowSamples.flatMap((s) => detector.push(s)).filter((e) => e.name === "rep");

      expect(events).toHaveLength(1);
      expect(events[0]!.data!.tooFast).toBe(0);
      expect(events[0]!.data!.tempoSec).toBeGreaterThanOrEqual(1.2);
    });
  });

  describe("6. EMA smoothing", () => {
    it("dampens high-frequency jitter using exponential moving average", () => {
      const smoothedDetector = createTestDetector({ smoothingMs: 500 });
      const responsiveDetector = createTestDetector({ smoothingMs: 15 });

      // Calibrate baselines
      smoothedDetector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));
      responsiveDetector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Single 50 ms spike of 50° that immediately returns to 0°
      const spike = makeSample({ t: 50, beta: 50, gamma: 0 });
      const rest = makeSample({ t: 100, beta: 0, gamma: 0 });

      // With heavy smoothing: angle stays low => never triggers ASCENDING
      expect(smoothedDetector.push(spike)).toHaveLength(0);
      expect(smoothedDetector.push(rest)).toHaveLength(0);

      // With responsive smoothing: responds to spike
      responsiveDetector.push(spike);
      const respEvents = responsiveDetector.push(rest).filter((e) => e.name === "rep");
      expect(respEvents).toHaveLength(1);
    });
  });

  describe("7. Hysteresis and prevention of double-counting", () => {
    it("does not trigger for micro-movements within the hysteresis band (<= 10°)", () => {
      const detector = createTestDetector();
      const events: ReturnType<typeof detector.push> = [];

      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Jitters between 0° and 8° (<= 10° hysteresisDeg)
      for (let t = 50; t <= 2000; t += 50) {
        const jitter = Math.sin(t / 100) * 8;
        events.push(...detector.push(makeSample({ t, beta: jitter, gamma: 0 })));
      }

      // Zero rep events emitted
      expect(events.filter((e) => e.name === "rep")).toHaveLength(0);
    });

    it("prevents multiple counts during movement reversals above hysteresis band", () => {
      const detector = createTestDetector({ smoothingMs: 30 });
      const events: ReturnType<typeof detector.push> = [];

      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Ascends to 50° at t = 500
      events.push(...detector.push(makeSample({ t: 500, beta: 50, gamma: 0 })));
      // Fluctuates between 45° and 55° (above 10° hysteresis)
      events.push(...detector.push(makeSample({ t: 600, beta: 45, gamma: 0 })));
      events.push(...detector.push(makeSample({ t: 700, beta: 55, gamma: 0 })));
      events.push(...detector.push(makeSample({ t: 800, beta: 48, gamma: 0 })));

      // No repetition completes until returning within hysteresis band (<= 10°)
      expect(events.filter((e) => e.name === "rep")).toHaveLength(0);

      // Now returns to rest
      events.push(...detector.push(makeSample({ t: 1400, beta: 5, gamma: 0 })));
      events.push(...detector.push(makeSample({ t: 1500, beta: 0, gamma: 0 })));
      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.count).toBe(1);
    });
  });

  describe("8. Incomplete movements and interrupted repetitions", () => {
    it("does not emit rep if movement ascends but never returns to rest", () => {
      const detector = createTestDetector({ smoothingMs: 50 });
      const events: ReturnType<typeof detector.push> = [];

      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Ascends to 60°
      for (let t = 50; t <= 1000; t += 50) {
        events.push(...detector.push(makeSample({ t, beta: (t / 1000) * 60, gamma: 0 })));
      }

      // Holds at 60° for another 2 seconds without lowering
      for (let t = 1050; t <= 3000; t += 50) {
        events.push(...detector.push(makeSample({ t, beta: 60, gamma: 0 })));
      }

      // Interrupted rep never completed
      expect(events.filter((e) => e.name === "rep")).toHaveLength(0);
    });
  });

  describe("9. Reset behavior", () => {
    it("clears rep count, baseline, and active movement on reset()", () => {
      const detector = createTestDetector({ smoothingMs: 50 });

      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));

      // Complete 1 rep
      const samples = generateRepSamples(50, 1500, 60, 50);
      for (const s of samples) {
        detector.push(s);
      }

      // Reset detector
      detector.reset();

      // Next rep starts fresh from count = 0
      detector.push(makeSample({ t: 2000, beta: 0, gamma: 0 }));
      const events: ReturnType<typeof detector.push> = [];
      const nextSamples = generateRepSamples(2050, 1500, 60, 50);
      for (const s of nextSamples) {
        events.push(...detector.push(s));
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.count).toBe(1);
    });
  });

  describe("10 & 11. Invalid, missing and non-finite values", () => {
    it("safely ignores non-finite values without corrupting state", () => {
      const detector = createTestDetector();

      expect(detector.push(makeSample({ t: NaN, beta: 50 }))).toEqual([]);
      expect(detector.push(makeSample({ t: 100, ax: NaN }))).toEqual([]);
      expect(detector.push(makeSample({ t: 150, ay: Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 200, beta: -Infinity }))).toEqual([]);
      expect(detector.push(makeSample({ t: 250, gamma: NaN }))).toEqual([]);

      // Clean rep operation afterwards succeeds
      detector.reset();
      detector.push(makeSample({ t: 300, beta: 0, gamma: 0 }));
      const events: ReturnType<typeof detector.push> = [];
      const samples = generateRepSamples(350, 1500, 60, 50);
      for (const s of samples) {
        events.push(...detector.push(s));
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.count).toBe(1);
    });
  });

  describe("12. Backward timestamps and large timestamp gaps", () => {
    it("resets state when timestamp jumps backward", () => {
      const detector = createTestDetector({ smoothingMs: 50 });

      detector.push(makeSample({ t: 1000, beta: 0, gamma: 0 }));
      detector.push(makeSample({ t: 1500, beta: 50, gamma: 0 }));

      // Backward timestamp jump (e.g. recording loop)
      const jumpEvents = detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));
      expect(jumpEvents.filter((e) => e.name === "rep")).toHaveLength(0);

      // Clean rep starting after the jump
      const events: ReturnType<typeof detector.push> = [];
      const samples = generateRepSamples(50, 1500, 60, 50);
      for (const s of samples) {
        events.push(...detector.push(s));
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.count).toBe(1);
    });

    it("resets state when a large temporal gap occurs (> 2.0s)", () => {
      const detector = createTestDetector({ smoothingMs: 50 });
      const events: ReturnType<typeof detector.push> = [];

      detector.push(makeSample({ t: 0, beta: 0, gamma: 0 }));
      // Halfway ascending
      detector.push(makeSample({ t: 500, beta: 50, gamma: 0 }));

      // Large 3-second gap
      events.push(...detector.push(makeSample({ t: 3500, beta: 50, gamma: 0 })));
      // Returns to rest
      events.push(...detector.push(makeSample({ t: 4000, beta: 0, gamma: 0 })));

      // Stale interrupted motion dropped due to gap
      expect(events.filter((e) => e.name === "rep")).toHaveLength(0);
    });
  });

  describe("14. Deterministic results when replaying the same samples", () => {
    it("produces identical events when replaying identical sample sequences", () => {
      const detector1 = createTestDetector({ smoothingMs: 50 });
      const detector2 = createTestDetector({ smoothingMs: 50 });

      const samples = [makeSample({ t: 0, beta: 0, gamma: 0 }), ...generateRepSamples(50, 1500, 60, 50)];

      const events1: ReturnType<typeof detector1.push> = [];
      const events2: ReturnType<typeof detector2.push> = [];

      for (const s of samples) {
        events1.push(...detector1.push(s));
        events2.push(...detector2.push(s));
      }

      expect(events1).toEqual(events2);
    });
  });

  describe("Real Ghost Recording validation", () => {
    it("never emits a rep event for a stationary phone resting flat on a table", () => {
      const detector = createRepDetector();
      const detectedEvents: ReturnType<typeof detector.push> = [];

      for (const sample of tableFlatRecording.samples) {
        detectedEvents.push(...detector.push(sample as Sample));
      }

      const repEvents = detectedEvents.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(0);
    });
  });

  describe("Technical Review Regression Tests", () => {
    it("1. State-machine trap: excursion peaking at 11° returning to 8°–9° resets cleanly without sticking", () => {
      const detector = createTestDetector({
        hysteresisDeg: 10,
        minRomDeg: 45,
        smoothingMs: 1,
      });

      // Calibrate resting baseline at 0°
      detector.push(makeSample({ t: 0, beta: 0 }));
      expect(detector.getState()).toBe("REST");

      // Ascent crosses hysteresis (10°) to 11°
      detector.push(makeSample({ t: 100, beta: 10.5 }));
      expect(detector.getState()).toBe("ASCENDING");

      detector.push(makeSample({ t: 150, beta: 11.0 }));
      expect(detector.getState()).toBe("ASCENDING");

      // Drops to 10.5° (stops climbing, enters PEAK)
      detector.push(makeSample({ t: 200, beta: 10.5 }));
      expect(detector.getState()).toBe("PEAK");

      // Drops to 8.5°: drops below hysteresis (10°) WITHOUT meeting minRomDeg
      // Correct behavior: returns cleanly to REST without sticking
      const trapEvents = detector.push(makeSample({ t: 250, beta: 8.5 }));
      expect(trapEvents.filter((e) => e.name === "rep")).toHaveLength(0);
      expect(detector.getState()).toBe("REST");
      expect(detector.status().count).toBe(0);

      // Subsequent resting sample transitions cleanly back to REST
      detector.push(makeSample({ t: 300, beta: 0 }));
      expect(detector.getState()).toBe("REST");
    });

    it("2. Valid full repetition immediately following an incomplete movement counts correctly", () => {
      const detector = createTestDetector({
        hysteresisDeg: 10,
        minRomDeg: 45,
        smoothingMs: 20,
      });

      // Calibrate resting baseline
      detector.push(makeSample({ t: 0, beta: 0 }));

      // Step A: Partial movement peaking at 11° and returning to 8°
      detector.push(makeSample({ t: 100, beta: 10.5 }));
      detector.push(makeSample({ t: 150, beta: 11.0 }));
      detector.push(makeSample({ t: 200, beta: 10.5 }));
      const partialEvents = detector.push(makeSample({ t: 250, beta: 8.0 }));
      expect(partialEvents.filter((e) => e.name === "rep")).toHaveLength(0);
      expect(detector.getState()).toBe("REST");

      // Step B: Valid full repetition immediately after: 0° -> 60° -> 0° over 1600 ms
      const fullEvents: ReturnType<typeof detector.push> = [];
      const samples = generateRepSamples(500, 1600, 60, 50);
      for (const s of samples) {
        fullEvents.push(...detector.push(s));
      }

      const fullReps = fullEvents.filter((e) => e.name === "rep");
      expect(fullReps).toHaveLength(1);
      expect(fullReps[0]!.data!.count).toBe(1);
      expect(fullReps[0]!.data!.fullRange).toBe(1);
      expect(fullReps[0]!.data!.tooFast).toBe(0);
      expect(fullReps[0]!.data!.romDeg).toBeGreaterThanOrEqual(45);
    });

    it("3. Correct repetition count and tempoSec after partial movement (timing reflects only the completed rep)", () => {
      const detector = createTestDetector({
        hysteresisDeg: 10,
        minRomDeg: 45,
        minTempoSec: 1.2,
        smoothingMs: 20,
      });

      // Calibrate baseline
      detector.push(makeSample({ t: 0, beta: 0 }));

      // Partial excursion: t = 100 to t = 300
      detector.push(makeSample({ t: 100, beta: 12 }));
      detector.push(makeSample({ t: 200, beta: 15 }));
      const partialEvents = detector.push(makeSample({ t: 300, beta: 5 }));
      expect(partialEvents.filter((e) => e.name === "rep")).toHaveLength(0);

      // Rest interval until t = 1000
      detector.push(makeSample({ t: 500, beta: 0 }));
      detector.push(makeSample({ t: 1000, beta: 0 }));

      // Full rep starts at t = 1100, peaks at t = 1900, completes at t = 2700 (duration = 1600 ms = 1.6s)
      const fullSamples = generateRepSamples(1100, 1600, 60, 50);
      const fullEvents: ReturnType<typeof detector.push> = [];
      for (const s of fullSamples) {
        fullEvents.push(...detector.push(s));
      }

      const fullReps = fullEvents.filter((e) => e.name === "rep");
      expect(fullReps).toHaveLength(1);
      const fullRep = fullReps[0]!;
      expect(fullRep.data!.count).toBe(1); // Exactly 1
      expect(fullRep.data!.fullRange).toBe(1);
      expect(fullRep.data!.tooFast).toBe(0);
      // Tempo should reflect only the duration of the full rep (~1.45s), NOT 2.6s from partial rep start
      expect(fullRep.data!.tempoSec).toBeGreaterThanOrEqual(1.2);
      expect(fullRep.data!.tempoSec).toBeLessThan(2.0);
    });

    it("4. Holding at peak: excursion that holds at a 60° peak for 1.5 seconds before descending completes normally", () => {
      const detector = createTestDetector({
        smoothingMs: 1,
        minTempoSec: 1.2,
      });

      // Calibrate baseline
      detector.push(makeSample({ t: 0, beta: 0 }));

      // Ascend from 0° to 60°: t = 100 to t = 1000 (900 ms)
      for (let t = 100; t <= 1000; t += 100) {
        const angle = (t / 1000) * 60;
        detector.push(makeSample({ t, beta: angle }));
      }

      // Hold at 60° peak for 1500 ms: t = 1100 to t = 2600
      for (let t = 1100; t <= 2600; t += 100) {
        const events = detector.push(makeSample({ t, beta: 60 }));
        // Must NOT emit rep while holding at peak
        expect(events.filter((e) => e.name === "rep")).toHaveLength(0);
        // State must remain at PEAK during steady hold
        expect(detector.getState()).toBe("PEAK");
      }

      // Descend from 60° back to 0°: t = 2700 to t = 3600 (900 ms)
      const completionEvents: ReturnType<typeof detector.push> = [];
      for (let t = 2700; t <= 3600; t += 100) {
        const angle = 60 - ((t - 2600) / 1000) * 60;
        completionEvents.push(...detector.push(makeSample({ t, beta: angle })));
      }

      const repEvents = completionEvents.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      const rep = repEvents[0]!;
      expect(rep.data!.count).toBe(1);
      expect(rep.data!.fullRange).toBe(1);
      expect(rep.data!.tooFast).toBe(0);
      expect(rep.data!.romDeg).toBeCloseTo(60, 0);
      expect(rep.data!.tempoSec).toBeGreaterThanOrEqual(3.0);
    });

    it("5. Non-horizontal baseline: exercise movement starting from vertical armband orientation (gravity on Y axis)", () => {
      // Resting armband orientation: phone vertical along arm (gravity on Y axis: ay = 9.81, az = 0)
      const detector = createTestDetector({
        baseline: { ax: 0, ay: 9.81, az: 0 },
        smoothingMs: 20,
      });

      const events: ReturnType<typeof detector.push> = [];

      // Arm curl: forearm curls upward from vertical (ay = 9.81, az = 0) to horizontal (ay = 0, az = 9.81)
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const t = i * 50;
        const progress = i / steps; // 0 -> 1 -> 0
        const angleDeg = 85 * Math.sin(progress * Math.PI);
        const rad = (angleDeg * Math.PI) / 180;
        const ay = 9.81 * Math.cos(rad);
        const az = 9.81 * Math.sin(rad);

        events.push(
          ...detector.push(
            makeSample({
              t,
              ax: 0,
              ay,
              az,
              beta: 90 - angleDeg,
              gamma: 0,
            }),
          ),
        );
      }

      const repEvents = events.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      const e = repEvents[0]!;
      expect(e.data!.count).toBe(1);
      expect(e.data!.fullRange).toBe(1);
      expect(e.data!.romDeg).toBeGreaterThanOrEqual(80);
      expect(e.data!.tempoSec).toBeGreaterThanOrEqual(1.2);
    });

    it("6. Combined pitch and roll: verifies true 3D spatial angle without artificial inflation", () => {
      const detector = createTestDetector({
        minRomDeg: 45,
        hysteresisDeg: 10,
        smoothingMs: 1,
      });

      // Calibrate flat baseline at (0, 0, 9.81)
      detector.push(makeSample({ t: 0, ax: 0, ay: 0, az: 9.81, beta: 0, gamma: 0 }));

      // Test A: Simultaneous 30° pitch and 30° roll
      // True 3D spatial angle from vertical is arccos(cos(30°) * cos(30°)) = arccos(0.75) ≈ 41.41°
      // Since 41.41° < minRomDeg (45°), this must NOT count as a repetition!
      const pitchRad = (30 * Math.PI) / 180;
      const rollRad = (30 * Math.PI) / 180;
      const ax30 = 9.81 * Math.sin(rollRad);
      const ay30 = -9.81 * Math.sin(pitchRad) * Math.cos(rollRad);
      const az30 = 9.81 * Math.cos(pitchRad) * Math.cos(rollRad);

      // Ascend to 30°/30° diagonal
      detector.push(makeSample({ t: 100, ax: ax30, ay: ay30, az: az30, beta: 30, gamma: 30 }));
      // Return to rest
      const diagonalEvents = detector.push(makeSample({ t: 500, ax: 0, ay: 0, az: 9.81, beta: 0, gamma: 0 }));

      // Because true angle is 41.41° (< 45° minRomDeg), NO rep event is emitted
      expect(diagonalEvents.filter((e) => e.name === "rep")).toHaveLength(0);
      expect(detector.status().count).toBe(0);

      // Test B: Diagonal motion with pitch = 36°, roll = 36°
      // cos(36°) * cos(36°) = 0.8090² ≈ 0.6545 => arccos(0.6545) ≈ 49.1° (>= 45° minRomDeg)
      const p36Rad = (36 * Math.PI) / 180;
      const r36Rad = (36 * Math.PI) / 180;
      const ax36 = 9.81 * Math.sin(r36Rad);
      const ay36 = -9.81 * Math.sin(p36Rad) * Math.cos(r36Rad);
      const az36 = 9.81 * Math.cos(p36Rad) * Math.cos(r36Rad);

      detector.push(makeSample({ t: 1000, ax: ax36, ay: ay36, az: az36, beta: 36, gamma: 36 }));
      const fullDiagonalEvents = detector.push(
        makeSample({ t: 2500, ax: 0, ay: 0, az: 9.81, beta: 0, gamma: 0 }),
      );

      const fullReps = fullDiagonalEvents.filter((e) => e.name === "rep");
      expect(fullReps).toHaveLength(1);
      expect(fullReps[0]!.data!.fullRange).toBe(1);
      expect(fullReps[0]!.data!.count).toBe(1);
      expect(fullReps[0]!.data!.romDeg).toBeCloseTo(49.1, 0);
    });

    it("7. Zero-magnitude vectors: free fall returns no usable direction", () => {
      const detector = createRepDetector();

      // Free fall / zero acceleration
      const events: ReturnType<typeof detector.push> = [];
      for (let t = 0; t <= 1000; t += 50) {
        events.push(
          ...detector.push(
            makeSample({
              t,
              ax: 0,
              ay: 0,
              az: 0,
              beta: 0,
              gamma: 0,
            }),
          ),
        );
      }

      expect(events).toHaveLength(0);
      expect(detector.status().calibrated).toBe(false);
    });

    it("8. Repeated and interrupted movements: multiple partial movements followed by full repetitions", () => {
      const detector = createTestDetector({
        hysteresisDeg: 10,
        minRomDeg: 45,
        smoothingMs: 20,
      });

      detector.push(makeSample({ t: 0, beta: 0 }));

      const allEvents: ReturnType<typeof detector.push> = [];
      let currentT = 100;

      // 1. Partial movement 1: 0° -> 20° -> 0° (< 45°)
      for (const s of generateRepSamples(currentT, 1000, 20, 50)) {
        allEvents.push(...detector.push(s));
      }
      currentT += 1200;

      // 2. Partial movement 2: 0° -> 35° -> 0° (< 45°)
      for (const s of generateRepSamples(currentT, 1000, 35, 50)) {
        allEvents.push(...detector.push(s));
      }
      currentT += 1200;

      // 3. Full rep 1: 0° -> 60° -> 0° (>= 45°)
      for (const s of generateRepSamples(currentT, 1500, 60, 50)) {
        allEvents.push(...detector.push(s));
      }
      currentT += 1700;

      // 4. Full rep 2: 0° -> 50° -> 0° (>= 45°)
      for (const s of generateRepSamples(currentT, 1500, 50, 50)) {
        allEvents.push(...detector.push(s));
      }
      currentT += 1700;

      // 5. Partial movement 3: 0° -> 25° -> 0° (< 45°)
      for (const s of generateRepSamples(currentT, 1000, 25, 50)) {
        allEvents.push(...detector.push(s));
      }
      currentT += 1200;

      // 6. Full rep 3: 0° -> 70° -> 0° (>= 45°)
      for (const s of generateRepSamples(currentT, 1500, 70, 50)) {
        allEvents.push(...detector.push(s));
      }

      // Check results: only the 3 valid full repetitions emitted rep events
      const repEvents = allEvents.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(3);
      expect(repEvents[0]!.data!.count).toBe(1);
      expect(repEvents[1]!.data!.count).toBe(2);
      expect(repEvents[2]!.data!.count).toBe(3);
    });

    it("9. All state transitions: explicitly verifies REST → ASCENDING → PEAK → DESCENDING → COMPLETED → REST", () => {
      const detector = createTestDetector({
        hysteresisDeg: 10,
        minRomDeg: 45,
        smoothingMs: 1,
      });

      // Step 1: Initial baseline orientation
      detector.push(makeSample({ t: 0, beta: 0 }));
      expect(detector.getState()).toBe("REST");

      // Step 2: Rising above hysteresis (10°) -> transitions to ASCENDING
      detector.push(makeSample({ t: 100, beta: 20 }));
      expect(detector.getState()).toBe("ASCENDING");

      // Climbing higher stays in ASCENDING
      detector.push(makeSample({ t: 200, beta: 55 }));
      expect(detector.getState()).toBe("ASCENDING");

      // Step 3: Halting climb (theta < peakAngle) -> transitions to PEAK
      detector.push(makeSample({ t: 300, beta: 54.5 }));
      expect(detector.getState()).toBe("PEAK");

      // Step 4: Downward inflection (dropped by at least 1.5° below 55°) -> transitions to DESCENDING
      detector.push(makeSample({ t: 400, beta: 53.0 }));
      expect(detector.getState()).toBe("DESCENDING");

      // Continued descent stays in DESCENDING
      detector.push(makeSample({ t: 500, beta: 25.0 }));
      expect(detector.getState()).toBe("DESCENDING");

      // Step 5: Returning within hysteresis (<= 10°) -> completes rep and enters COMPLETED
      const completeEvents = detector.push(makeSample({ t: 600, beta: 5.0 }));
      const repEvents = completeEvents.filter((e) => e.name === "rep");
      expect(repEvents).toHaveLength(1);
      expect(repEvents[0]!.data!.count).toBe(1);
      expect(repEvents[0]!.data!.fullRange).toBe(1);
      expect(detector.getState()).toBe("COMPLETED");

      // Step 6: Subsequent resting sample returns cleanly to REST
      detector.push(makeSample({ t: 700, beta: 0 }));
      expect(detector.getState()).toBe("REST");
    });
  });
});
