import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { GestureEvent, Sample } from "@haunt-kit/protocol";
import { repStreamGen, shakingStreamGen } from "./generators";
import { createTiltDetector } from "../detectors/tilt";
import { createShakeDetector } from "../detectors/shake";
import { createHoldStillDetector } from "../detectors/hold-still";
import { createFlickDetector } from "../detectors/flick";
import { createSpinDetector } from "../detectors/spin";
import { createFlipDetector } from "../detectors/flip";
import { createScreamDetector } from "../detectors/scream";
import { createTapDetector, type TapSample } from "../detectors/tap";
import { createRepDetector } from "../detectors/rep";

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

function assertCausalBounds(events: GestureEvent[], s0: number, send: number): void {
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) {
    expect(e.t).toBeGreaterThanOrEqual(s0);
    expect(e.t).toBeLessThanOrEqual(send);
  }
}

describe("PBT Invariant 4: Temporal Causality across All Nine Detectors", () => {
  it("1. tilt: all emitted continuous tilt events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 5000 }), // startT
        fc.array(
          fc.tuple(
            fc.double({ min: -60, max: 60, noNaN: true }), // pitch beta
            fc.double({ min: -60, max: 60, noNaN: true }), // roll gamma
          ),
          { minLength: 10, maxLength: 50 },
        ),
        (startT, frames) => {
          const detector = createTiltDetector();
          const samples: Sample[] = frames.map(([beta, gamma], i) =>
            makeSample({ t: startT + i * 20, beta, gamma }),
          );

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          expect(events).toHaveLength(samples.length);
          assertCausalBounds(events, s0, send);
        },
      ),
      { numRuns: 35, seed: 11111 },
    );
  });

  it("2. shake: all emitted shake events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(shakingStreamGen(60), (samples) => {
        const detector = createShakeDetector();
        const s0 = samples[0]!.t;
        const send = samples[samples.length - 1]!.t;
        const events: GestureEvent[] = [];

        for (const s of samples) {
          events.push(...detector.push(s));
        }

        assertCausalBounds(events, s0, send);
      }),
      { numRuns: 35, seed: 22222 },
    );
  });

  it("3. hold-still: all hold-still and hold-still-broken events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.integer({ min: 1300, max: 1800 }), // still duration > 1200ms
        fc.integer({ min: 200, max: 500 }), // motion duration
        (startT, stillMs, motionMs) => {
          const detector = createHoldStillDetector({ holdDurationMs: 1200 });
          const samples: Sample[] = [];
          const stepMs = 25;

          // Phase 1: Stationary phone for > 1200ms -> emits hold-still (state: 1)
          const stillSteps = Math.floor(stillMs / stepMs);
          for (let i = 0; i <= stillSteps; i++) {
            samples.push(makeSample({ t: startT + i * stepMs, ax: 0, ay: 0, az: 9.81 }));
          }

          // Phase 2: Active motion with high variance -> emits hold-still-broken (state: 0)
          const tMotionStart = samples[samples.length - 1]!.t + stepMs;
          const motionSteps = Math.floor(motionMs / stepMs);
          for (let i = 0; i <= motionSteps; i++) {
            const acc = i % 2 === 0 ? 5.0 : -5.0;
            samples.push(makeSample({ t: tMotionStart + i * stepMs, ax: acc, ay: acc, az: 9.81 }));
          }

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          // Must produce both hold-still and hold-still-broken
          const states = events.map((e) => e.data?.state);
          expect(states).toContain(1);
          expect(states).toContain(0);
          assertCausalBounds(events, s0, send);
        },
      ),
      { numRuns: 35, seed: 33333 },
    );
  });

  it("4. flick: all emitted flick impulse events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.double({ min: 40.0, max: 70.0, noNaN: true }), // sharp acceleration impulse m/s²
        (startT, impulseAcc) => {
          const detector = createFlickDetector();
          const samples: Sample[] = [
            makeSample({ t: startT, ax: 0, ay: 0, az: 9.81 }),
            makeSample({ t: startT + 50, ax: 0, ay: 0, az: 9.81 }),
            // Sharp impulse over 15ms -> jerk = (impulseAcc - 0) / 0.015 > 2500 m/s³ >> 35.0
            makeSample({ t: startT + 65, ax: impulseAcc, ay: 0, az: 9.81 }),
            makeSample({ t: startT + 80, ax: impulseAcc * 0.5, ay: 0, az: 9.81 }),
            makeSample({ t: startT + 120, ax: 0, ay: 0, az: 9.81 }),
          ];

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          assertCausalBounds(events, s0, send);
          expect(events[0]!.name).toBe("flick");
        },
      ),
      { numRuns: 35, seed: 44444 },
    );
  });

  it("5. spin: all emitted spin events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.double({ min: 360, max: 500, noNaN: true }), // rotation rate gz deg/s (> 300 deg/s)
        (startT, gzRate) => {
          const detector = createSpinDetector();
          const samples: Sample[] = [];
          const stepMs = 25;
          const durationMs = 1000;
          const steps = Math.floor(durationMs / stepMs);

          for (let i = 0; i <= steps; i++) {
            samples.push(makeSample({ t: startT + i * stepMs, gz: gzRate }));
          }

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          assertCausalBounds(events, s0, send);
          expect(events[0]!.name).toBe("spin");
        },
      ),
      { numRuns: 35, seed: 55555 },
    );
  });

  it("6. flip: all emitted flip events (faceDown: 1 & 0) satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.integer({ min: 250, max: 400 }), // face-down hold duration > 200ms
        (startT, holdMs) => {
          const detector = createFlipDetector();
          const samples: Sample[] = [];
          const stepMs = 25;

          // 1. Phone face up
          samples.push(makeSample({ t: startT, az: 9.81 }));

          // 2. Flip face down (az < -7.0 m/s²) and hold for > 200ms -> emits faceDown: 1
          const stepsHold = Math.floor(holdMs / stepMs);
          const tFaceDown = startT + stepMs;
          for (let i = 0; i <= stepsHold; i++) {
            samples.push(makeSample({ t: tFaceDown + i * stepMs, az: -9.81 }));
          }

          // 3. Flip back face up -> emits faceDown: 0 after holdMs (200ms)
          const tFlipBack = samples[samples.length - 1]!.t + stepMs;
          for (let i = 0; i <= 10; i++) {
            samples.push(makeSample({ t: tFlipBack + i * stepMs, az: 9.81 }));
          }

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          // Verifies both faceDown: 1 and faceDown: 0 events emitted
          const faceDownValues = events.map((e) => e.data?.faceDown);
          expect(faceDownValues).toContain(1);
          expect(faceDownValues).toContain(0);
          assertCausalBounds(events, s0, send);
        },
      ),
      { numRuns: 35, seed: 66666 },
    );
  });

  it("7. scream: all emitted scream events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.double({ min: 0.7, max: 0.95, noNaN: true }), // loudness > 0.65 threshold
        fc.integer({ min: 350, max: 500 }), // scream duration > 300ms
        (startT, loudness, durationMs) => {
          const detector = createScreamDetector();
          const samples: Sample[] = [];
          const stepMs = 25;

          // 1. Quiet baseline
          samples.push(makeSample({ t: startT, rms: 0.05 }));

          // 2. Sustained loudness > 0.65 for >= 300ms -> emits scream
          const steps = Math.floor(durationMs / stepMs);
          const tScream = startT + stepMs;
          for (let i = 0; i <= steps; i++) {
            samples.push(makeSample({ t: tScream + i * stepMs, rms: loudness }));
          }

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          assertCausalBounds(events, s0, send);
          expect(events[0]!.name).toBe("scream");
        },
      ),
      { numRuns: 35, seed: 77777 },
    );
  });

  it("8. tap: all emitted tap events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }), // startT
        fc.double({ min: 0.05, max: 0.95, noNaN: true }), // x
        fc.double({ min: 0.05, max: 0.95, noNaN: true }), // y
        (startT, tapX, tapY) => {
          const detector = createTapDetector();
          const tapSample: TapSample = {
            ...makeSample({ t: startT + 50 }),
            touch: { x: tapX, y: tapY },
          };
          const samples: Sample[] = [makeSample({ t: startT }), tapSample, makeSample({ t: startT + 100 })];

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          assertCausalBounds(events, s0, send);
          expect(events[0]!.name).toBe("tap");
          expect(events[0]!.data?.x).toBeCloseTo(tapX, 5);
          expect(events[0]!.data?.y).toBeCloseTo(tapY, 5);
        },
      ),
      { numRuns: 35, seed: 88888 },
    );
  });

  it("9. rep: all emitted repetition events satisfy s0.t <= event.t <= send.t", () => {
    fc.assert(
      fc.property(repStreamGen({ minReps: 1, maxReps: 3 }), ({ samples }) => {
        const detector = createRepDetector({ smoothingFactor: 0.8 });
        const s0 = samples[0]!.t;
        const send = samples[samples.length - 1]!.t;
        const events: GestureEvent[] = [];

        for (const s of samples) {
          events.push(...detector.push(s));
        }

        assertCausalBounds(events, s0, send);
        const repEvents = events.filter((e) => e.name === "rep");
        expect(repEvents.length).toBeGreaterThanOrEqual(1);
        expect(repEvents[0]!.name).toBe("rep");
      }),
      { numRuns: 35, seed: 99999 },
    );
  });
});
