// Owner: Anish. Registry that maps a gesture name to its detector.
import type { Detector } from "@haunt-kit/protocol";
import {
  doubleShakeDetector,
  flickDetector,
  flipDetector,
  holdStillDetector,
  repDetector,
  screamDetector,
  shakeDetector,
  spinDetector,
  tapDetector,
  tiltDetector,
} from "./detectors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDetector = Detector<any>;

/**
 * Registry mapping detector names to Detector instances (Design §2.1).
 * Supports both method lookups (catalog.get("shake")), creation (catalog.create("shake")),
 * and direct property indexing (catalog["shake"]).
 */
export class GestureCatalog {
  [key: string]: unknown;

  private readonly detectors = new Map<string, AnyDetector>();

  register<T = unknown>(detector: Detector<T>): this {
    this.detectors.set(detector.name, detector as AnyDetector);
    (this as Record<string, unknown>)[detector.name] = detector;
    return this;
  }

  get<T = unknown>(name: string): Detector<T> | undefined {
    return this.detectors.get(name) as Detector<T> | undefined;
  }

  has(name: string): boolean {
    return this.detectors.has(name);
  }

  list(): string[] {
    return Array.from(this.detectors.keys());
  }

  getAll(): AnyDetector[] {
    return Array.from(this.detectors.values());
  }

  /** A new detector instance with its default config merged with `config`. */
  create(name: string, config?: Record<string, unknown>) {
    const detector = this.detectors.get(name);
    if (!detector) throw new Error(`Unknown gesture "${name}". Known: ${this.list().join(", ")}`);
    return detector.create({ ...(detector.defaults as object), ...config });
  }
}

/**
 * Factory creating a fresh GestureCatalog pre-populated with default detectors.
 */
export function createDefaultCatalog(): GestureCatalog & Record<string, AnyDetector | undefined> {
  const cat = new GestureCatalog()
    .register(tiltDetector)
    .register(shakeDetector)
    .register(holdStillDetector)
    .register(flickDetector)
    .register(spinDetector)
    .register(flipDetector)
    .register(screamDetector)
    .register(tapDetector)
    .register(repDetector)
    .register(doubleShakeDetector);
  return cat as GestureCatalog & Record<string, AnyDetector | undefined>;
}

/** All built-in detectors. */
export const catalog: GestureCatalog & Record<string, AnyDetector | undefined> = createDefaultCatalog();

/** Alias for default catalog instance. */
export const gestureCatalog = catalog;
