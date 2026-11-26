// Owner: Anish. Benchmark test suite validating all 10 detectors against real benchmark recordings.
// Task 4.4: Validation Against Real Benchmark Recordings in recordings/.
//
// Hardware note: All 6 benchmark recordings in recordings/ were recorded on Android (Chrome).
// No physical iPhone (iOS/Safari) recordings are present in the repository.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GestureEvent, Sample } from "@haunt-kit/protocol";
import { recordingSchema, type GhostRecording } from "./schema";
import { ReplayPlayer } from "./player";
import { createTiltDetector } from "../detectors/tilt";
import { createShakeDetector } from "../detectors/shake";
import { createDoubleShakeDetector } from "../detectors/double-shake";
import { createHoldStillDetector } from "../detectors/hold-still";
import { createFlickDetector } from "../detectors/flick";
import { createSpinDetector } from "../detectors/spin";
import { createFlipDetector } from "../detectors/flip";
import { createScreamDetector } from "../detectors/scream";
import { createTapDetector } from "../detectors/tap";
import { createRepDetector } from "../detectors/rep";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const recordingsDir = fs.existsSync(path.resolve(__dirname, "../../../../recordings"))
  ? path.resolve(__dirname, "../../../../recordings")
  : path.resolve(process.cwd(), "recordings");

interface DetectorSuiteEvents {
  tilt: GestureEvent[];
  shake: GestureEvent[];
  doubleShake: GestureEvent[];
  holdStill: GestureEvent[];
  flick: GestureEvent[];
  spin: GestureEvent[];
  flip: GestureEvent[];
  scream: GestureEvent[];
  tap: GestureEvent[];
  rep: GestureEvent[];
}

function replayThroughAllDetectors(recording: GhostRecording): {
  events: DetectorSuiteEvents;
  samples: readonly Sample[];
} {
  const tilt = createTiltDetector();
  const shake = createShakeDetector();
  const doubleShake = createDoubleShakeDetector();
  const holdStill = createHoldStillDetector();
  const flick = createFlickDetector();
  const spin = createSpinDetector();
  const flip = createFlipDetector();
  const scream = createScreamDetector();
  const tap = createTapDetector();
  const rep = createRepDetector();

  const events: DetectorSuiteEvents = {
    tilt: [],
    shake: [],
    doubleShake: [],
    holdStill: [],
    flick: [],
    spin: [],
    flip: [],
    scream: [],
    tap: [],
    rep: [],
  };

  const player = new ReplayPlayer(recording);
  player.playImmediate((sample) => {
    events.tilt.push(...tilt.push(sample));
    events.shake.push(...shake.push(sample));
    events.doubleShake.push(...doubleShake.push(sample));
    events.holdStill.push(...holdStill.push(sample));
    events.flick.push(...flick.push(sample));
    events.spin.push(...spin.push(sample));
    events.flip.push(...flip.push(sample));
    events.scream.push(...scream.push(sample));
    events.tap.push(...tap.push(sample));
    events.rep.push(...rep.push(sample));
  });

  return { events, samples: recording.samples };
}

describe("Task 4.4: Validation Against Real Benchmark Recordings", () => {
  const recordingFiles = fs
    .readdirSync(recordingsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  it("finds and validates all 6 real benchmark recordings against RecordingSchema", () => {
    expect(recordingFiles).toHaveLength(6);

    for (const filename of recordingFiles) {
      const raw = fs.readFileSync(path.join(recordingsDir, filename), "utf8");
      const parsed = recordingSchema.parse(JSON.parse(raw));

      // All 6 benchmark recordings in the repository were collected on Android Chrome
      expect(parsed.meta.os).toBe("Android");
      expect(parsed.meta.browser).toBe("Chrome");
      expect(parsed.meta.sampleRateHz).toBeGreaterThanOrEqual(50);
      expect(parsed.samples.length).toBeGreaterThanOrEqual(300);
    }
  });

  describe("Stationary table recordings (flat-table baseline)", () => {
    const flatTableFiles = [
      "ghost-recording-table-flat-2026-11-17T17-28-41-306Z.json",
      "ghost-recording-table-flat-2026-11-17T17-44-05-337Z.json",
    ];

    for (const file of flatTableFiles) {
      it(`accurately evaluates stationary table baseline in ${file}`, () => {
        const raw = fs.readFileSync(path.join(recordingsDir, file), "utf8");
        const recording = recordingSchema.parse(JSON.parse(raw));
        const { events, samples } = replayThroughAllDetectors(recording);

        // 1. Tilt Detector: Every sample is clamped to exactly (0, 0) by center dead zone (+-5 deg)
        expect(events.tilt).toHaveLength(samples.length);
        for (const e of events.tilt) {
          expect(e.data?.x).toBe(0);
          expect(e.data?.y).toBe(0);
        }

        // 2. Hold-Still Detector: Activates after ~1200ms of stillness, emits hold-still (state: 1)
        expect(events.holdStill.length).toBeGreaterThan(0);
        const holdStillEvent = events.holdStill[0]!;
        expect(holdStillEvent.name).toBe("hold-still");
        expect(holdStillEvent.data?.state).toBe(1);
        expect(holdStillEvent.t).toBeGreaterThanOrEqual(1200);

        // Crucial invariant: Never emits broken event (state: 0) while phone remains flat on table
        const brokenEvents = events.holdStill.filter((e) => e.data?.state === 0);
        expect(brokenEvents).toHaveLength(0);

        // 3. Negative validation / False-Positive Immunity:
        // Flat table motion must NEVER trigger shake, double-shake, flick, spin, flip, scream, tap, or rep
        expect(events.shake).toHaveLength(0);
        expect(events.doubleShake).toHaveLength(0);
        expect(events.flick).toHaveLength(0);
        expect(events.spin).toHaveLength(0);
        expect(events.flip).toHaveLength(0);
        expect(events.scream).toHaveLength(0);
        expect(events.tap).toHaveLength(0);
        expect(events.rep.filter((e) => e.name === "rep")).toHaveLength(0);
      });
    }
  });

  describe("Dynamic motion recordings (hand-held roll, slide, and tilt)", () => {
    it("validates dynamic tilt tracking and lateral strokes in android-left-right", () => {
      const file = "ghost-recording-android-left-right-2026-11-17T17-47-51-393Z.json";
      const raw = fs.readFileSync(path.join(recordingsDir, file), "utf8");
      const recording = recordingSchema.parse(JSON.parse(raw));
      const { events, samples } = replayThroughAllDetectors(recording);

      // Tilt emits for every frame and tracks left-right roll transitions
      expect(events.tilt).toHaveLength(samples.length);
      const xValues = events.tilt.map((e) => (e.data?.x as number) ?? 0);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      expect(minX).toBeLessThan(-0.2);
      expect(maxX).toBeGreaterThan(0.2);

      // Hold-still activates during initial rest at t < 1.3s, then breaks when active motion resumes
      expect(events.holdStill).toHaveLength(2);
      expect(events.holdStill[0]!.name).toBe("hold-still");
      expect(events.holdStill[0]!.data?.state).toBe(1);
      expect(events.holdStill[1]!.name).toBe("hold-still-broken");
      expect(events.holdStill[1]!.data?.state).toBe(0);

      // With minDeltaMs2: 8 protection in place, sensor noise during ordinary
      // left-right rocking motion does not trigger false flick events.
      expect(events.flick).toHaveLength(0);

      // False-positive immunity: No shake, double-shake, spin, flip, scream, tap, or rep increments
      expect(events.shake).toHaveLength(0);
      expect(events.doubleShake).toHaveLength(0);
      expect(events.spin).toHaveLength(0);
      expect(events.flip).toHaveLength(0);
      expect(events.scream).toHaveLength(0);
      expect(events.tap).toHaveLength(0);
      const completedReps = events.rep.filter((e) => e.data?.count && (e.data.count as number) > 0);
      expect(completedReps).toHaveLength(0);
      const fullRangeReps = events.rep.filter((e) => e.data?.fullRange === 1);
      expect(fullRangeReps).toHaveLength(0);
    });

    it("validates wide-range inclination and motion rejection of hold-still in android-slide", () => {
      const file = "ghost-recording-android-slide-2026-11-17T17-53-27-552Z.json";
      const raw = fs.readFileSync(path.join(recordingsDir, file), "utf8");
      const recording = recordingSchema.parse(JSON.parse(raw));
      const { events, samples } = replayThroughAllDetectors(recording);

      // Tilt emits for every frame and tracks wide inclination up to steep pitch
      expect(events.tilt).toHaveLength(samples.length);
      const yValues = events.tilt.map((e) => (e.data?.y as number) ?? 0);
      const maxY = Math.max(...yValues);
      expect(maxY).toBeGreaterThan(0.7);

      // Continuous active sliding motion throughout prevents hold-still from falsely activating
      expect(events.holdStill).toHaveLength(0);

      // False-positive immunity: smooth sliding produces no shake, double-shake, spin, flip, scream, tap, or rep counts
      expect(events.shake).toHaveLength(0);
      expect(events.doubleShake).toHaveLength(0);
      expect(events.spin).toHaveLength(0);
      expect(events.flip).toHaveLength(0);
      expect(events.scream).toHaveLength(0);
      expect(events.tap).toHaveLength(0);
      const completedReps = events.rep.filter((e) => e.data?.count && (e.data.count as number) > 0);
      expect(completedReps).toHaveLength(0);
      const fullRangeReps = events.rep.filter((e) => e.data?.fullRange === 1);
      expect(fullRangeReps).toHaveLength(0);
    });

    it("validates hand-held tilt motion in ghost-recording-table-flat-17-31", () => {
      const file = "ghost-recording-table-flat-2026-11-17T17-31-09-199Z.json";
      const raw = fs.readFileSync(path.join(recordingsDir, file), "utf8");
      const recording = recordingSchema.parse(JSON.parse(raw));
      const { events, samples } = replayThroughAllDetectors(recording);

      // Phone was picked up from table and held tilted at ~41 deg
      expect(events.tilt).toHaveLength(samples.length);
      const yValues = events.tilt.map((e) => (e.data?.y as number) ?? 0);
      expect(Math.max(...yValues)).toBeGreaterThan(0.5);

      // Hold-still latches during initial table rest, then breaks when picked up
      expect(events.holdStill).toHaveLength(2);
      expect(events.holdStill[0]!.data?.state).toBe(1);
      expect(events.holdStill[1]!.data?.state).toBe(0);

      // False-positive immunity
      expect(events.shake).toHaveLength(0);
      expect(events.doubleShake).toHaveLength(0);
      expect(events.spin).toHaveLength(0);
      expect(events.flip).toHaveLength(0);
      expect(events.scream).toHaveLength(0);
      expect(events.tap).toHaveLength(0);
      const completedReps = events.rep.filter((e) => e.data?.count && (e.data.count as number) > 0);
      expect(completedReps).toHaveLength(0);
      const fullRangeReps = events.rep.filter((e) => e.data?.fullRange === 1);
      expect(fullRangeReps).toHaveLength(0);
    });

    it("validates stationary hand-held reading angle in android-test-01", () => {
      const file = "ghost-recording-android-test-01-2026-11-17T17-19-29-358Z.json";
      const raw = fs.readFileSync(path.join(recordingsDir, file), "utf8");
      const recording = recordingSchema.parse(JSON.parse(raw));
      const { events, samples } = replayThroughAllDetectors(recording);

      // Steady hand-held posture at pitch ~25 deg
      expect(events.tilt).toHaveLength(samples.length);
      const yValues = events.tilt.map((e) => (e.data?.y as number) ?? 0);
      const meanY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
      expect(meanY).toBeGreaterThan(0.3);
      expect(meanY).toBeLessThan(0.7);

      // Hold-still latches during steady holding
      expect(events.holdStill.length).toBeGreaterThan(0);
      expect(events.holdStill[0]!.data?.state).toBe(1);

      // Micro-motion hand tremors must never register as exercise repetitions
      const completedReps = events.rep.filter((e) => e.data?.count && (e.data.count as number) > 0);
      expect(completedReps).toHaveLength(0);
      const fullRangeReps = events.rep.filter((e) => e.data?.fullRange === 1);
      expect(fullRangeReps).toHaveLength(0);

      // False-positive immunity: No shake, double-shake, spin, flip, scream, or tap
      expect(events.shake).toHaveLength(0);
      expect(events.doubleShake).toHaveLength(0);
      expect(events.spin).toHaveLength(0);
      expect(events.flip).toHaveLength(0);
      expect(events.scream).toHaveLength(0);
      expect(events.tap).toHaveLength(0);
    });
  });

  describe("Consolidated 10-Detector Matrix across All Benchmark Recordings", () => {
    for (const filename of recordingFiles) {
      it(`enforces strict event validity and temporal causality across all 10 detectors in ${filename}`, () => {
        const raw = fs.readFileSync(path.join(recordingsDir, filename), "utf8");
        const recording = recordingSchema.parse(JSON.parse(raw));
        const { events, samples } = replayThroughAllDetectors(recording);

        const s0 = samples[0]!.t;
        const send = samples[samples.length - 1]!.t;

        const allEmittedEvents: GestureEvent[] = [
          ...events.tilt,
          ...events.shake,
          ...events.doubleShake,
          ...events.holdStill,
          ...events.flick,
          ...events.spin,
          ...events.flip,
          ...events.scream,
          ...events.tap,
          ...events.rep,
        ];

        // Every emitted event across every detector must be temporally bounded
        for (const e of allEmittedEvents) {
          expect(e.t).toBeGreaterThanOrEqual(s0);
          expect(e.t).toBeLessThanOrEqual(send);
        }

        // Detectors whose physical gestures never occur in any of the 6 benchmark files:
        // - No shake (max accel 11.08 < 18.0 m/s²)
        // - No double-shake (no initial shake burst occurs)
        // - No spin (max |gz| = 86 deg/s < 300 deg/s)
        // - No flip (min az = 0.3 m/s² > -7.0 m/s², always face up)
        // - No scream (max rms = 0.05 < 0.65)
        // - No tap (touch is undefined on motion recordings)
        //
        // Note on Flick: The 6 benchmark recordings capture continuous table and hand-held
        // motions without annotated ground truth for physical impulse flicks. Because these
        // recordings lack reliable negative ground truth for sharp rotational impulse transitions,
        // we assert flick absence only on stationary flat-table baselines where the phone is
        // known to be completely still, and avoid uniform negative assertions across unannotated
        // dynamic recordings.
        expect(events.shake).toHaveLength(0);
        expect(events.doubleShake).toHaveLength(0);
        expect(events.spin).toHaveLength(0);
        expect(events.flip).toHaveLength(0);
        expect(events.scream).toHaveLength(0);
        expect(events.tap).toHaveLength(0);

        // Rep detector: zero completed repetitions across all benchmark recordings
        const completedReps = events.rep.filter((e) => e.data?.count && (e.data.count as number) > 0);
        expect(completedReps).toHaveLength(0);

        // Tilt detector: emits exactly 1 event per sample across all recordings
        expect(events.tilt).toHaveLength(samples.length);
      });
    }
  });
});
