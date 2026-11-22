import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLICK_CONFIG,
  DEFAULT_FLIP_CONFIG,
  DEFAULT_HOLD_STILL_CONFIG,
  DEFAULT_REP_CONFIG,
  DEFAULT_SCREAM_CONFIG,
  DEFAULT_SHAKE_CONFIG,
  DEFAULT_SPIN_CONFIG,
  DEFAULT_TAP_CONFIG,
  DEFAULT_TILT_CONFIG,
  FLICK_DIRECTION,
  FLIP_STATE,
  PACKAGE_NAME,
  RECORDING_OS,
  RecordingMetaSchema,
  RecordingSchema,
  ReplayPlayer,
  SPIN_DIRECTION,
  createFlickDetector,
  createFlipDetector,
  createGhostPlayer,
  createHoldStillDetector,
  createRepDetector,
  createScreamDetector,
  createShakeDetector,
  createSpinDetector,
  createTapDetector,
  createTiltDetector,
  flickDetector,
  flipDetector,
  holdStillDetector,
  recordingMetaSchema,
  recordingSchema,
  repDetector,
  sampleSchema,
  screamDetector,
  shakeDetector,
  spinDetector,
  tapDetector,
  tiltDetector,
  type AnyDetector,
  type FlickConfig,
  type FlickDirection,
  type FlipConfig,
  type FlipState,
  type GhostPlayerAdapter,
  type GhostPlayerOptions,
  type GhostRecording,
  type HoldStillConfig,
  type PlayRealtimeOptions,
  type RecordingMeta,
  type RecordingOS,
  type RepBaseline,
  type RepConfig,
  type RepDetectorInstance,
  type RepState,
  type Sample,
  type ScreamConfig,
  type ShakeConfig,
  type SpinConfig,
  type SpinDirection,
  type TapConfig,
  type TapSample,
  type TiltConfig,
} from "./index";

// Compile-time check that every public type is exported.
type _PublicTypes = [
  GhostPlayerAdapter,
  GhostPlayerOptions,
  GhostRecording,
  HoldStillConfig,
  PlayRealtimeOptions,
  RecordingMeta,
  RecordingOS,
  Sample,
  ShakeConfig,
  TiltConfig,
  FlickConfig,
  FlickDirection,
  SpinConfig,
  SpinDirection,
  FlipConfig,
  FlipState,
  ScreamConfig,
  TapConfig,
  TapSample,
  RepConfig,
  RepBaseline,
  RepState,
  RepDetectorInstance,
  AnyDetector,
];

describe("@haunt-kit/gestures public exports", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("@haunt-kit/gestures");
  });

  it("re-exports protocol Sample type and sampleSchema", () => {
    const s: Sample = {
      t: 0,
      ax: 0,
      ay: 0,
      az: 9.81,
      gx: 0,
      gy: 0,
      gz: 0,
      alpha: 90,
      beta: 0,
      gamma: 0,
    };
    expect(s.az).toBeCloseTo(9.81);

    const parsed = sampleSchema.parse(s);
    expect(parsed.az).toBeCloseTo(9.81);
  });

  it("exports Ghost Recording schemas and constants", () => {
    expect(recordingMetaSchema).toBeDefined();
    expect(recordingSchema).toBeDefined();
    expect(RecordingMetaSchema).toBe(recordingMetaSchema);
    expect(RecordingSchema).toBe(recordingSchema);
    expect(RECORDING_OS).toEqual(["Android", "iOS", "Desktop", "Synthetic"]);
  });

  it("exports ReplayPlayer and can instantiate and play samples", () => {
    expect(ReplayPlayer).toBeDefined();

    const mockRecording: GhostRecording = {
      meta: {
        label: "export-test",
        os: "Android",
        browser: "Chrome",
        sampleRateHz: 60,
        recordedAt: "2026-11-17T17:47:51.372Z",
      },
      samples: [
        {
          t: 0,
          ax: 0,
          ay: 0,
          az: 9.81,
          gx: 0,
          gy: 0,
          gz: 0,
          alpha: 0,
          beta: 0,
          gamma: 0,
        },
      ],
    };

    const player = new ReplayPlayer(mockRecording);
    expect(player.sampleCount).toBe(1);

    const received: Sample[] = [];
    player.playImmediate((s) => received.push(s));
    expect(received).toHaveLength(1);
    expect(received[0]!.az).toBeCloseTo(9.81);
  });

  it("exports createGhostPlayer and produces a valid GhostPlayerAdapter", () => {
    expect(createGhostPlayer).toBeDefined();

    const mockRecording: GhostRecording = {
      meta: {
        label: "adapter-export-test",
        os: "Android",
        browser: "Chrome",
        sampleRateHz: 60,
        recordedAt: "2026-11-17T17:47:51.372Z",
      },
      samples: [
        {
          t: 0,
          ax: 0,
          ay: 0,
          az: 9.81,
          gx: 0,
          gy: 0,
          gz: 0,
          alpha: 0,
          beta: 0,
          gamma: 0,
        },
      ],
    };

    const adapter: GhostPlayerAdapter = createGhostPlayer(
      "ghost-export-1",
      "Public Export Bot",
      mockRecording,
    );

    expect(adapter.id).toBe("ghost-export-1");
    expect(adapter.name).toBe("Public Export Bot");
    expect(adapter.isPlaying).toBe(false);
  });

  it("exports tilt detector, factory and default config", () => {
    expect(tiltDetector).toBeDefined();
    expect(tiltDetector.name).toBe("tilt");
    expect(tiltDetector.defaults).toEqual(DEFAULT_TILT_CONFIG);
    expect(createTiltDetector).toBeDefined();

    const instance = createTiltDetector();
    const events = instance.push({
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
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("tilt");
    expect(events[0]!.data).toEqual({ x: 0, y: 0 });
  });

  it("exports shake detector, factory and default config", () => {
    expect(shakeDetector).toBeDefined();
    expect(shakeDetector.name).toBe("shake");
    expect(shakeDetector.defaults).toEqual(DEFAULT_SHAKE_CONFIG);
    expect(createShakeDetector).toBeDefined();

    const instance = createShakeDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports hold-still detector, factory and default config", () => {
    expect(holdStillDetector).toBeDefined();
    expect(holdStillDetector.name).toBe("hold-still");
    expect(holdStillDetector.defaults).toEqual(DEFAULT_HOLD_STILL_CONFIG);
    expect(createHoldStillDetector).toBeDefined();

    const instance = createHoldStillDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports flick detector, factory and default config", () => {
    expect(flickDetector).toBeDefined();
    expect(flickDetector.name).toBe("flick");
    expect(flickDetector.defaults).toEqual(DEFAULT_FLICK_CONFIG);
    expect(createFlickDetector).toBeDefined();
    expect(FLICK_DIRECTION).toBeDefined();

    const instance = createFlickDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports spin detector, factory and default config", () => {
    expect(spinDetector).toBeDefined();
    expect(spinDetector.name).toBe("spin");
    expect(spinDetector.defaults).toEqual(DEFAULT_SPIN_CONFIG);
    expect(createSpinDetector).toBeDefined();
    expect(SPIN_DIRECTION).toBeDefined();

    const instance = createSpinDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports flip detector, factory and default config", () => {
    expect(flipDetector).toBeDefined();
    expect(flipDetector.name).toBe("flip");
    expect(flipDetector.defaults).toEqual(DEFAULT_FLIP_CONFIG);
    expect(createFlipDetector).toBeDefined();
    expect(FLIP_STATE).toBeDefined();

    const instance = createFlipDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports scream detector, factory and default config", () => {
    expect(screamDetector).toBeDefined();
    expect(screamDetector.name).toBe("scream");
    expect(screamDetector.defaults).toEqual(DEFAULT_SCREAM_CONFIG);
    expect(createScreamDetector).toBeDefined();

    const instance = createScreamDetector();
    const noEvents = instance.push({
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
      rms: 0.1,
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports tap detector, factory and default config", () => {
    expect(tapDetector).toBeDefined();
    expect(tapDetector.name).toBe("tap");
    expect(tapDetector.defaults).toEqual(DEFAULT_TAP_CONFIG);
    expect(createTapDetector).toBeDefined();

    const instance = createTapDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });

  it("exports rep detector, factory and default config", () => {
    expect(repDetector).toBeDefined();
    expect(repDetector.name).toBe("rep");
    expect(repDetector.defaults).toEqual(DEFAULT_REP_CONFIG);
    expect(createRepDetector).toBeDefined();

    const instance = createRepDetector();
    const noEvents = instance.push({
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
    });
    expect(noEvents).toHaveLength(0);
  });
});
