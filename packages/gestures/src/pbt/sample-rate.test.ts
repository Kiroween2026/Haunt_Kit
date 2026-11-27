import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { GestureEvent } from "@haunt-kit/protocol";
import { createContinuousRepTrajectory, sampleTrajectory, shakingTrajectoryArb } from "./generators";
import { createShakeDetector } from "../detectors/shake";
import { createRepDetector } from "../detectors/rep";

describe("PBT Invariant 3: Sample-Rate Invariance (30 Hz to 120 Hz)", () => {
  it("shake detector produces consistent detection counts for trajectories sampled across 30 Hz to 120 Hz", () => {
    fc.assert(
      fc.property(
        shakingTrajectoryArb,
        fc.integer({ min: 30, max: 55 }), // lower sample rate
        fc.integer({ min: 65, max: 120 }), // higher sample rate
        (traj, rateLow, rateHigh) => {
          const detectorLow = createShakeDetector();
          const detectorHigh = createShakeDetector();

          const samplesLow = sampleTrajectory(traj, rateLow);
          const samplesHigh = sampleTrajectory(traj, rateHigh);

          const eventsLow: GestureEvent[] = [];
          const eventsHigh: GestureEvent[] = [];

          for (const s of samplesLow) {
            eventsLow.push(...detectorLow.push(s));
          }

          for (const s of samplesHigh) {
            eventsHigh.push(...detectorHigh.push(s));
          }

          // Both sample rates must agree on whether the continuous trajectory constitutes a shake
          const hasShakeLow = eventsLow.length > 0;
          const hasShakeHigh = eventsHigh.length > 0;
          expect(hasShakeLow).toBe(hasShakeHigh);

          // If a shake is detected, event count is preserved across sampling rates
          if (hasShakeLow) {
            expect(eventsLow.length).toBe(eventsHigh.length);
          }
        },
      ),
      { numRuns: 30, seed: 60606 },
    );
  });

  it("rep counter counts exactly N reps across 30 Hz, 60 Hz, and 120 Hz sample rates", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }), // N reps
        fc.double({ min: 55, max: 70, noNaN: true }), // Peak ROM
        fc.double({ min: 1400, max: 1800, noNaN: true }), // Rep duration (tempo >= 1.2s)
        (repCount, peakAngleDeg, repDurationMs) => {
          const traj = createContinuousRepTrajectory({
            repCount,
            repDurationMs,
            restDurationMs: 600,
            peakAngleDeg,
          });

          const testRates = [30, 60, 120];
          const detectedCounts: number[] = [];
          const baselineDurationMs = 2200; // >= 2100 ms stationary baseline period

          for (const rate of testRates) {
            // Default 2000 ms calibration (calibrationMs: 0 workaround removed)
            const detector = createRepDetector({ targetRomDeg: 45, smoothingFactor: 0.8 });
            const dt = 1000 / rate;
            const events: GestureEvent[] = [];

            // Prepend stationary baseline of at least 2100 ms to complete calibration
            const baselineSteps = Math.ceil(baselineDurationMs / dt);
            for (let i = 0; i <= baselineSteps; i++) {
              const t = Math.round(i * dt);
              events.push(
                ...detector.push({
                  t,
                  ax: 0,
                  ay: 0,
                  az: 9.81,
                  gx: 0,
                  gy: 0,
                  gz: 0,
                  alpha: 0,
                  beta: 0,
                  gamma: 0,
                }),
              );
            }

            expect(detector.status().calibrated).toBe(true);

            // Start the generated rep trajectory after calibration completes
            const startT = Math.round(baselineSteps * dt) + Math.round(dt);
            const samples = sampleTrajectory(traj, rate, startT);
            for (const s of samples) {
              events.push(...detector.push(s));
            }

            const reps = events.filter((e) => e.name === "rep");
            detectedCounts.push(reps.length);
          }

          // All sample rates (30Hz, 60Hz, 120Hz) produce identical rep count N
          expect(detectedCounts[0]).toBe(repCount);
          expect(detectedCounts[1]).toBe(repCount);
          expect(detectedCounts[2]).toBe(repCount);
        },
      ),
      { numRuns: 25, seed: 70707 },
    );
  });
});
