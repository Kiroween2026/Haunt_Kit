import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { GestureEvent } from "@haunt-kit/protocol";
import { microMotionStreamGen, repStreamGen } from "./generators";
import { createRepDetector } from "../detectors/rep";

describe("PBT Invariant 4 & 5: Rep Counter Determinism & Temporal Causality", () => {
  describe("Invariant 5: Rep Determinism", () => {
    it("sequence of N synthetic reps produces exactly N counts", () => {
      fc.assert(
        fc.property(repStreamGen({ minReps: 1, maxReps: 5 }), ({ samples, expectedReps }) => {
          const detector = createRepDetector({ smoothingFactor: 0.8 });
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          const repEvents = events.filter((e) => e.name === "rep");
          expect(repEvents).toHaveLength(expectedReps);

          // Verify sequential counting: 1, 2, ..., N
          for (let i = 0; i < repEvents.length; i++) {
            expect(repEvents[i]!.data?.count).toBe(i + 1);
          }
        }),
        { numRuns: 35, seed: 80808 },
      );
    });

    it("micro-movements strictly below minRomDeg (45°) never increment count", () => {
      fc.assert(
        fc.property(microMotionStreamGen(60), ({ samples }) => {
          const detector = createRepDetector();
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          const repEvents = events.filter((e) => e.name === "rep");
          // Zero reps counted for micro-movements below minRomDeg
          expect(repEvents).toHaveLength(0);
          expect(detector.status().count).toBe(0);
        }),
        { numRuns: 35, seed: 90909 },
      );
    });
  });

  describe("Invariant 4: Temporal Causality", () => {
    it("every emitted rep event timestamp is causally bounded: s0.t <= event.t <= send.t", () => {
      fc.assert(
        fc.property(repStreamGen({ minReps: 1, maxReps: 3 }), ({ samples }) => {
          const detector = createRepDetector({ smoothingFactor: 0.8 });
          const events: GestureEvent[] = [];

          for (const s of samples) {
            events.push(...detector.push(s));
          }

          const s0 = samples[0]!.t;
          const send = samples[samples.length - 1]!.t;

          expect(events.length).toBeGreaterThanOrEqual(1);

          for (const e of events) {
            expect(e.t).toBeGreaterThanOrEqual(s0);
            expect(e.t).toBeLessThanOrEqual(send);
          }
        }),
        { numRuns: 30, seed: 12345 },
      );
    });
  });
});
