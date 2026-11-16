import { describe, expect, it } from "vitest";
import type { Sample } from "./index";
import { PACKAGE_NAME } from "./index";

describe("@haunt-kit/gestures", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@haunt-kit/gestures");
  });

  it("re-exports the protocol Sample type", () => {
    const s: Sample = { t: 0, ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, alpha: 0, beta: 0, gamma: 0 };
    expect(s.az).toBeCloseTo(9.81);
  });
});
