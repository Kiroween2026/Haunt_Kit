import { describe, expect, it } from "vitest";
import type { Detector, GestureEvent, Sample } from "@haunt-kit/protocol";
import { GestureCatalog, catalog, createDefaultCatalog, gestureCatalog } from "./catalog";
import { tiltDetector } from "./detectors/tilt";
import { shakeDetector } from "./detectors/shake";
import { holdStillDetector } from "./detectors/hold-still";
import { flickDetector } from "./detectors/flick";
import { spinDetector } from "./detectors/spin";
import { flipDetector } from "./detectors/flip";
import { screamDetector } from "./detectors/scream";
import { tapDetector } from "./detectors/tap";
import { repDetector } from "./detectors/rep";
import { doubleShakeDetector } from "./detectors/double-shake";

const EXPECTED_ORDER = [
  "tilt",
  "shake",
  "hold-still",
  "flick",
  "spin",
  "flip",
  "scream",
  "tap",
  "rep",
  "double-shake",
];

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

describe("Gesture Catalog (Task 4.2)", () => {
  describe("Default Catalog & Spec Registration", () => {
    it("registers all default detectors in specification order", () => {
      expect(catalog.list()).toEqual(EXPECTED_ORDER);
    });

    it("gestureCatalog is an alias to catalog", () => {
      expect(gestureCatalog).toBe(catalog);
    });

    it("has() returns true for all registered detectors", () => {
      for (const name of EXPECTED_ORDER) {
        expect(catalog.has(name)).toBe(true);
      }
    });

    it("getAll() returns all detector instances in specification order", () => {
      const all = catalog.getAll();
      expect(all).toHaveLength(10);
      expect(all.map((d) => d.name)).toEqual(EXPECTED_ORDER);
      expect(all[0]).toBe(tiltDetector);
      expect(all[1]).toBe(shakeDetector);
      expect(all[2]).toBe(holdStillDetector);
      expect(all[3]).toBe(flickDetector);
      expect(all[4]).toBe(spinDetector);
      expect(all[5]).toBe(flipDetector);
      expect(all[6]).toBe(screamDetector);
      expect(all[7]).toBe(tapDetector);
      expect(all[8]).toBe(repDetector);
      expect(all[9]).toBe(doubleShakeDetector);
    });
  });

  describe("Retrieval: get() and Direct Property Indexing", () => {
    it("retrieves each detector via get(name) with correct defaults and metadata", () => {
      expect(catalog.get("tilt")).toBe(tiltDetector);
      expect(catalog.get("shake")).toBe(shakeDetector);
      expect(catalog.get("hold-still")).toBe(holdStillDetector);
      expect(catalog.get("flick")).toBe(flickDetector);
      expect(catalog.get("spin")).toBe(spinDetector);
      expect(catalog.get("flip")).toBe(flipDetector);
      expect(catalog.get("scream")).toBe(screamDetector);
      expect(catalog.get("tap")).toBe(tapDetector);
      expect(catalog.get("rep")).toBe(repDetector);
    });

    it("supports direct property indexing (catalog[name]) matching controller usage", () => {
      expect(catalog["tilt"]).toBe(tiltDetector);
      expect(catalog["shake"]).toBe(shakeDetector);
      expect(catalog["hold-still"]).toBe(holdStillDetector);
      expect(catalog["flick"]).toBe(flickDetector);
      expect(catalog["spin"]).toBe(spinDetector);
      expect(catalog["flip"]).toBe(flipDetector);
      expect(catalog["scream"]).toBe(screamDetector);
      expect(catalog["tap"]).toBe(tapDetector);
      expect(catalog["rep"]).toBe(repDetector);
    });

    it("verifies downstream phone controller mapping pattern", () => {
      const phoneDetectorNames = ["shake", "flick", "spin", "flip", "hold-still"];
      const phoneDetectors = phoneDetectorNames.map((n) => catalog[n]);

      expect(phoneDetectors).toHaveLength(5);
      expect(phoneDetectors[0]).toBe(shakeDetector);
      expect(phoneDetectors[1]).toBe(flickDetector);
      expect(phoneDetectors[2]).toBe(spinDetector);
      expect(phoneDetectors[3]).toBe(flipDetector);
      expect(phoneDetectors[4]).toBe(holdStillDetector);
    });

    it("returns undefined for unknown detector names across get() and property indexing", () => {
      expect(catalog.get("non-existent")).toBeUndefined();
      expect(catalog["non-existent"]).toBeUndefined();
      expect(catalog.has("non-existent")).toBe(false);
    });
  });

  describe("Detector Creation & Execution from Catalog", () => {
    it("creates an active detector instance from the catalog and processes samples", () => {
      const shakeEntry = catalog.get("shake");
      expect(shakeEntry).toBeDefined();

      const shakeInstance = shakeEntry!.create(shakeEntry!.defaults);
      expect(typeof shakeInstance.push).toBe("function");
      expect(typeof shakeInstance.reset).toBe("function");

      // Push baseline sample
      const events = shakeInstance.push(makeSample({ t: 0, ax: 0, ay: 0, az: 9.81 }));
      expect(events).toEqual([]);
    });

    it("creates detector instance via direct property indexing", () => {
      const flipEntry = catalog["flip"];
      expect(flipEntry).toBeDefined();

      const flipInstance = flipEntry!.create(flipEntry!.defaults);
      expect(typeof flipInstance.push).toBe("function");

      // Face-down sample
      const events = flipInstance.push(makeSample({ t: 0, az: -9.81 }));
      expect(events).toEqual([]);
    });
  });

  describe("Custom Registration & Overrides", () => {
    it("registers a custom detector updating both Map and direct property indexing", () => {
      const customCatalog = createDefaultCatalog();

      const customDetector: Detector<{ threshold: number }> = {
        name: "custom-nod",
        defaults: { threshold: 5 },
        create: () => ({
          push: () => [],
          reset: () => {},
        }),
      };

      customCatalog.register(customDetector);

      expect(customCatalog.has("custom-nod")).toBe(true);
      expect(customCatalog.get("custom-nod")).toBe(customDetector);
      expect(customCatalog["custom-nod"]).toBe(customDetector);
      expect(customCatalog.list()).toContain("custom-nod");
      expect(customCatalog.getAll()).toContain(customDetector);
      expect(customCatalog.list()).toHaveLength(11);
    });

    it("overriding an existing detector updates both lookups without duplicating in list()", () => {
      const customCatalog = createDefaultCatalog();

      const customShake: Detector<{ custom: boolean }> = {
        name: "shake",
        defaults: { custom: true },
        create: () => ({
          push: () => [],
          reset: () => {},
        }),
      };

      customCatalog.register(customShake);

      expect(customCatalog.get("shake")).toBe(customShake);
      expect(customCatalog["shake"]).toBe(customShake);
      // Verify list has no duplicate "shake" entries
      const list = customCatalog.list();
      expect(list.filter((name) => name === "shake")).toHaveLength(1);
      expect(list).toHaveLength(10);
    });
  });

  describe("Empty Catalog & Factory Isolation", () => {
    it("constructs an empty catalog when registerDefaults is false", () => {
      const emptyCatalog = new GestureCatalog();

      expect(emptyCatalog.list()).toEqual([]);
      expect(emptyCatalog.getAll()).toEqual([]);
      expect(emptyCatalog.has("shake")).toBe(false);
      expect(emptyCatalog.get("shake")).toBeUndefined();
      expect(emptyCatalog["shake"]).toBeUndefined();
    });

    it("createDefaultCatalog() returns an independent instance isolated from the singleton", () => {
      const independent = createDefaultCatalog();

      const dummyDetector: Detector<Record<string, never>> = {
        name: "dummy",
        defaults: {},
        create: () => ({
          push: (): GestureEvent[] => [],
          reset: () => {},
        }),
      };

      independent.register(dummyDetector);

      expect(independent.has("dummy")).toBe(true);
      // Singleton catalog must remain unaffected
      expect(catalog.has("dummy")).toBe(false);
      expect(catalog.get("dummy")).toBeUndefined();
      expect(catalog["dummy"]).toBeUndefined();
      expect(catalog.list()).toHaveLength(10);
    });
  });
});
